/** Build stamp injected at build time (next.config.ts). */
export const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";
export const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME ?? "";
export function buildLabel(): string {
  const d = BUILD_TIME ? new Date(BUILD_TIME) : null;
  const when = d ? `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} ${d.toISOString().slice(11, 16)} UTC` : "";
  return `Build ${BUILD_SHA}${when ? ` · ${when}` : ""}`;
}
