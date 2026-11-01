import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { renderBookingEmail, type BookingEmailSnapshot } from './bookingEmailTemplate.ts'
const sample: BookingEmailSnapshot = {venue:'VRena Thảo Điền',reference:'TD-TEST',status:'Confirmed',date:'2 Nov 2026',time:'18:30',players:'6',total:'1.440.000 ₫',source:'Walk-in',customerName:'Việt Anh',customerPhone:'+84900000001',customerEmail:'guest@example.com',notes:'Hello'}
test('Apps Script and booking app render byte-identical templates',()=>{
 const context=vm.createContext({})
 vm.runInContext(readFileSync(new URL('../docs/google-sheets-session-ticket-appscript.js',import.meta.url),'utf8'),context)
 const previous={...sample,time:'17:30',notes:''}
 assert.equal(context.renderBookingEmail(sample,previous,'edited').html,renderBookingEmail(sample,previous,'edited').html)
})
test('unchanged layout is identical except heading',()=>{
 assert.equal(renderBookingEmail(sample,null,'created').html.replace('New booking','Booking modified'),renderBookingEmail(sample,sample,'edited').html)
})
test('hostile contacts and notes are escaped and cannot create active links',()=>{
 const result=renderBookingEmail({...sample,customerEmail:'x" onclick="alert(1)',customerPhone:'javascript:alert(1)',notes:'<script>attack</script>'})
 assert.doesNotMatch(result.html,/<script>|href="javascript|href="mailto:x/)
 assert.match(result.html,/&lt;script&gt;/)
})
