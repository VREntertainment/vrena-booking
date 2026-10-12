"""Real PostgreSQL transactions; local Docker test databases ONLY.
Usage: python3 scripts/test-arena-concurrency.py [--baseline]
Load a schema-only copy + production booking functions, then the migration for
booking_atomic_test. No production connection, credentials, or email delivery.
"""
import concurrent.futures as cf
import json
import subprocess
import sys
import threading

BASELINE = '--baseline' in sys.argv
DB = 'booking_atomic_audit' if BASELINE else 'booking_atomic_test'
CONTAINER = 'supabase_db_vrena-health-ci'

def sql(query, role='service_role', uid=None):
    if BASELINE: query = query.replace('current_date+100', 'current_date+150' if 'create_cafe' in query else 'current_date+151').replace('+84999', '+84997')
    claims = json.dumps({'role': role, **({'sub': uid, 'aal': 'aal2'} if uid else {})})
    text = f"begin; set local statement_timeout='15s'; select set_config('request.jwt.claims','{claims}',true); select set_config('request.jwt.claim.role','{role}',true); {query}; commit;"
    r = subprocess.run(['docker','exec','-i',CONTAINER,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d',DB],input=text,text=True,capture_output=True)
    return r.returncode == 0, r.stdout.strip().splitlines()[2:], r.stderr.strip()

def check(query, role='service_role',uid=None):
    ok,lines,error=sql(query,role,uid)
    assert ok,error
    return lines

def cafe(i,day=100,start='16:00',duration=60):
    return f"select public.create_cafe_ticket_booking_request('individual',current_date+{day},'{start}',{duration},2,1,array['revolta'],'+849991{i:05d}','LOCAL AUDIT {i}')"

def hado(i,day=100,start='16:00',arenas=1,duration=60):
    return f"select public.create_guest_ticket_booking('individual',current_date+{day},'{start}',{duration},2,{arenas},array['revolta'],public.ticket_tariff_unit_price('ha-do-centrosa','individual',current_date+{day},'{start}'),public.ticket_tariff_unit_price('ha-do-centrosa','individual',current_date+{day},'{start}')*2*({duration}/30),'+849992{i:05d}','LOCAL AUDIT {i}')"

def direct(i,day=110,venue='cafe-des-stagiaires',start='16:00',arenas=1,duration=60,status='confirmed'):
    return f"insert into public.sessions(name,date,start_time,duration_minutes,max_players,arena_count,venue_key,booking_type,ticket_type,ticket_status,visibility) values ('LOCAL DIRECT {i}',current_date+{day},'{start}',{duration},2,{arenas},'{venue}','ticket','individual','{status}','private') returning id"

def race(name,queries,expected):
    barrier=threading.Barrier(len(queries))
    def run(query):
        barrier.wait()
        return sql(*query) if isinstance(query,tuple) else sql(query,'anon' if 'create_' in query else 'service_role')
    with cf.ThreadPoolExecutor(max_workers=len(queries)) as pool: results=list(pool.map(run,queries))
    successes=[r for r in results if r[0]]
    failures=[r[2] for r in results if not r[0]]
    if BASELINE and failures: print(json.dumps({'rejection_sample':failures[0]}),flush=True)
    result={'test':name,'attempts':len(queries),'accepted':len(successes),'rejected':len(failures)}
    print(json.dumps(result),flush=True)
    if not BASELINE:
        assert len(successes)==expected, (result,failures)
        assert all('available' in e or 'already booked' in e or 'exclusion' in e for e in failures),failures
        for r in successes:
            if 'ticket_status' in ''.join(r[1]):assert '"confirmed"' in ''.join(r[1]),r
    return successes

assert check("select count(*) from private.integration_settings where nullif(value,'') is not null")[-1]=='0','Outbound integrations must be empty'
race('Thao Dien last arena',[cafe(i) for i in range(12)],1)
race('Ha Do two arenas',[hado(i, start=f'16:{i:02d}' if BASELINE else '16:00') for i in range(12)],2)
if BASELINE:sys.exit(0)
race('Ha Do full-venue reservations',[hado(100+i,101,arenas=2) for i in range(12)],1)
race('Mixed direct writes and online bookings',[cafe(200+i,102) if i%2 else direct(i,102) for i in range(12)],1)
race('Partially overlapping starts',[cafe(300+i,103,'16:00' if i%2 else '16:30') for i in range(12)],1)
# Database trigger applies to direct writes, not only published RPC endpoints.
check(direct(1,104,status='pending'))
assert not sql(cafe(401,104),'anon')[0],'Pending reservations must hold capacity'
check("update public.sessions set ticket_status='cancelled' where date=current_date+104")
check(cafe(402,104),'anon')
check("update public.sessions set deleted_at=now() where date=current_date+104")
check(cafe(403,104),'anon')
check(cafe(404,104,'17:00'),'anon')
assert not sql("update public.sessions set start_time='16:30' where date=current_date+104 and start_time='17:00' and deleted_at is null")[0]
assert check("select start_time from public.sessions where date=current_date+104 and start_time='17:00' and deleted_at is null")[-1]=='17:00:00'
check("update public.sessions set status='completed' where date=current_date+104 and deleted_at is null")
check(cafe(405,104),'anon')
print('PASS pending holds; cancellation, deletion and completion release; adjacency; failed edit rollback',flush=True)
check("insert into public.blocked_times(date,start_time,end_time,arenas_used) values(current_date+105,'16:00','17:00',1)")
race('Ha Do with one blocked arena',[hado(500+i,105) for i in range(12)],1)
assert not sql("insert into public.blocked_times(date,start_time,end_time,arenas_used) values(current_date+105,'16:30','17:30',1)")[0]
check("delete from public.blocked_times where date=current_date+105")
check(hado(520,105),'anon')
print('PASS blocked-time conflict and release',flush=True)
# Both venues are independent; reservations may end exactly at closing.
check(cafe(601,106,'22:00'),'anon')
check(hado(601,106,'21:00'),'anon')
assert not sql(cafe(602,106,'22:10'),'anon')[0]
assert not sql(hado(602,106,'21:20'),'anon')[0]
assert not sql(direct(3,107,arenas=2))[0]
assert not sql(direct(4,107,duration=0))[0]
assert not sql(direct(5,107,start='23:30'))[0]
print('PASS venue independence; closing boundaries; invalid arena/duration rejected',flush=True)
# Every successful Ha Do online order records its actually allocated arena.
assert check("select count(distinct o.arena_id) from public.staff_orders o join public.sessions s on s.id=o.session_id where s.date=current_date+100 and s.venue_key='ha-do-centrosa'")[-1]=='2'
assert check("select count(*) from private.arena_reservations a join private.arena_reservations b on a.session_id<b.session_id and a.venue_key=b.venue_key and a.arena_number=b.arena_number and a.during && b.during")[-1]=='0'
assert check("select public.ticket_booking_start_is_past('2026-10-12','15:30','2026-10-12 08:30+00')")[-1]=='t'
print('PASS physical assignment; no overlapping claims; Vietnam time boundary',flush=True)
# REPEATABLE READ cannot evade the constraint with a stale snapshot.
# The normal pre-insert check uses an old snapshot; exclusion sees the conflict.
barrier=threading.Barrier(2)
def stale(i):
    cmd=f"begin isolation level repeatable read; select count(*) from private.arena_reservations; select pg_sleep(1); select set_config('request.jwt.claims','{{\"role\":\"service_role\"}}',true); {direct(i,108)}; commit;"
    barrier.wait()
    r=subprocess.run(['docker','exec','-i',CONTAINER,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d',DB],input=cmd,text=True,capture_output=True)
    return r.returncode==0,r.stderr
with cf.ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(stale,[1,2]))
assert sum(r[0] for r in results)==1,results
print('PASS repeatable-read stale snapshot rejects double booking',flush=True)
# Authenticated customer entry points use independent accounts and transactions.
users=[]
for i in range(8):
    users.append(check(f"select id from public.ensure_guest_ticket_profile('+849993{i:05d}','LOCAL AUTH {i}')")[-1])
race('Authenticated Thao Dien',[(cafe(800+i,112), 'authenticated',uid) for i,uid in enumerate(users)],1)
race('Authenticated Ha Do',[(f"select public.create_ticket_booking('individual',current_date+113,'16:00',60,2,1,array['revolta'],public.ticket_tariff_unit_price('ha-do-centrosa','individual',current_date+113,'16:00'),public.ticket_tariff_unit_price('ha-do-centrosa','individual',current_date+113,'16:00')*4)", 'authenticated',uid) for uid in users],2)
# Two arena reservations must also block direct staff reassignment to the same arena.
assert not sql("update public.staff_orders set arena_id='arena-1' where session_id in (select id from public.sessions where date=current_date+100 and venue_key='ha-do-centrosa')")[0]
assert check("select count(distinct arena_id) from public.staff_orders where session_id in (select id from public.sessions where date=current_date+100 and venue_key='ha-do-centrosa')")[-1]=='2'
assert check("select has_table_privilege('anon','private.arena_reservations','INSERT')")[-1]=='f'
assert check("select has_function_privilege('authenticated','private.reserve_arenas(uuid,uuid,text,timestamp,timestamp,integer,integer)','EXECUTE')")[-1]=='f'
assert check("set local role anon; select count(*) from public.booking_arena_occupancy(current_date+100,current_date+110)")[-1]!='0'
print('PASS staff reassignment rollback; private ledger permissions; anonymous occupancy read',flush=True)
print('ALL ATOMIC ARENA TESTS PASSED',flush=True)
