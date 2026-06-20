// 티스토리 로그인 세션(storage_state) 추출 — 로컬 1회용 도구 (액션 런타임과 무관).
// playwright 필요. bun이 아니라 node로 실행한다(Windows에서 bun은 CDP launch가 hang).
//   예) (이 레포 밖 windforce/frontend 등 playwright 있는 곳에서)
//       node scripts/capture-session.mjs ./state.json
// 결과 JSON 전체를 windforce 변수 tistory/storage_state 에 등록한다.
import { chromium } from "playwright";

const out = process.argv[2] || "./state.json";
const browser = await chromium.launch({
  headless: false,
  args: ["--disable-blink-features=AutomationControlled", "--start-maximized"],
});
const context = await browser.newContext({ viewport: null });
await (await context.newPage()).goto("https://www.tistory.com/auth/login");
console.log(`카카오로 로그인하세요. 로그인 완료 후 창을 닫으면 ${out} 에 세션이 저장됩니다.`);

const iv = setInterval(async () => {
  try { await context.storageState({ path: out }); } catch {}
}, 2000);
browser.on("disconnected", () => {
  clearInterval(iv);
  console.log("saved:", out);
  process.exit(0);
});
await new Promise(() => {});
