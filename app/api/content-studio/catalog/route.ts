import { isLanguageCode } from "../../../../lib/i18n/languages";
import { loadTranslation } from "../../../../lib/i18n/loadTranslation";

const sectionPrefixes = [
  ["ticket", "Tickets"],
  ["booking", "Tickets"],
  ["guest", "Tickets"],
  ["session", "Sessions"],
  ["create", "Sessions"],
  ["join", "Sessions"],
  ["club", "Clubs"],
  ["hall", "Hall of Fame"],
  ["leaderboard", "Hall of Fame"],
  ["champion", "Hall of Fame"],
  ["challenge", "Hall of Fame"],
  ["profile", "Profiles"],
  ["login", "Accounts"],
  ["account", "Accounts"],
  ["onboarding", "Onboarding"],
  ["game", "Games"],
  ["audience", "Games"],
  ["staff", "Staff"],
  ["admin", "Staff"],
] as const;

function humanize(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function sectionFor(key: string) {
  const normalizedKey = key.toLocaleLowerCase();
  return (
    sectionPrefixes.find(([prefix]) => normalizedKey.startsWith(prefix))?.[1] ??
    "General"
  );
}

export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") ?? "en";

  if (!isLanguageCode(locale)) {
    return Response.json(
      { error: "Unsupported web app language." },
      { status: 400 },
    );
  }

  const translation = await loadTranslation(locale);
  const catalog = Object.entries(translation).map(([key, value]) => ({
    id: `webappCopy:${locale}:${key}`,
    locale,
    group: "webapp",
    section: sectionFor(key),
    label: humanize(key),
    source: "webappCopy",
    sourcePath: key,
    value,
  }));

  return Response.json(
    { catalog },
    {
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
