// 티스토리 내부 관리 API 공통 유틸 (공식 Open API 종료 후 비공식 경로).
// 실측 캡처(Phase 0)로 확정한 계약:
//   발행  POST https://{blog}.tistory.com/manage/post.json      (application/json + 세션 쿠키)
//   목록  GET  https://{blog}.tistory.com/manage/posts.json     (페이지네이션)
//   분류  GET  https://{blog}.tistory.com/manage/category/simple.json
// CSRF 헤더는 없고 origin/referer + 세션 쿠키로 인증된다.

/** Playwright storage_state JSON에서 tistory.com 쿠키만 뽑아 Cookie 헤더 문자열로 만든다. */
export function buildCookieHeader(storageStateJson: string): string {
  let parsed: { cookies?: Array<{ name: string; value: string; domain: string }> };
  try {
    parsed = JSON.parse(storageStateJson);
  } catch {
    throw new Error("tistory/storage_state 변수가 유효한 JSON이 아닙니다(Playwright storageState 형식이어야 함).");
  }
  const cookies = (parsed.cookies || []).filter((c) => String(c.domain).includes("tistory.com"));
  if (cookies.length === 0) {
    throw new Error("storage_state에 tistory.com 쿠키가 없습니다 — 로그인 세션을 다시 추출하세요.");
  }
  // 같은 이름이 도메인별로 중복될 수 있어 마지막 값을 우선한다.
  const dedup = new Map<string, string>();
  for (const c of cookies) dedup.set(c.name, c.value);
  return [...dedup].map(([k, v]) => `${k}=${v}`).join("; ");
}

/** 발행 페이로드의 visibility 코드. 실측: 20=PUBLIC, 15=PROTECTED, 0=PRIVATE. */
export function visibilityCode(v: string | undefined): number {
  switch ((v || "private").toLowerCase()) {
    case "public": return 20;
    case "protected": return 15;
    case "private": return 0;
    default: return 0; // 안전 기본값 = 비공개
  }
}

/** posts.json 응답의 visibility 라벨("PUBLIC")을 우리 표준 소문자로. */
export function visibilityLabel(v: string): string {
  const m: Record<string, string> = { PUBLIC: "public", PRIVATE: "private", PROTECTED: "protected" };
  return m[v] || String(v).toLowerCase();
}

export function tistoryHeaders(blog: string, cookieHeader: string, referer: string): Record<string, string> {
  return {
    "accept": "application/json, text/plain, */*",
    "origin": `https://${blog}.tistory.com`,
    "referer": `https://${blog}.tistory.com/${referer}`,
    "cookie": cookieHeader,
  };
}
