// 마크다운 → 티스토리 본문 HTML.
// 티스토리 신에디터는 마크다운 모드로 입력해도 전송 직전 HTML로 변환해 보낸다(실측).
// API 직접 호출 시엔 그 변환을 우리가 해야 하므로 marked로 표준 HTML을 만든다.
import { marked } from "marked";

export function markdownToTistoryHtml(md: string): string {
  // GFM(표·코드펜스 등) 켜고 동기 변환. 티스토리는 표준 HTML 본문을 받는다.
  const html = marked.parse(md, { async: false, gfm: true });
  return html as string;
}
