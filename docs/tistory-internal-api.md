# 티스토리 비공식 발행 API (역공학 계약)

티스토리 공식 Open API는 2024년 2월 종료됐다(글·댓글·첨부 모두). 이 앱은 관리 페이지(`/manage`)가 내부적으로 쓰는 **비공식 JSON 엔드포인트**를 세션 쿠키로 직접 호출한다. 아래 계약은 실제 브라우저 발행 플로우를 캡처(HAR)해 확정한 것이다. **비공식이라 티스토리 관리 UI가 바뀌면 깨질 수 있다** — 그때는 [재캡처](#재캡처-깨질-때) 절차로 갱신한다.

> 적용 범위: **본인 블로그에 본인 글**을 발행/조회하는 용도로 한정한다. 자동화는 약관 회색지대다.

## 인증 — 세션 쿠키

카카오 로그인 통합 이후 아이디/비밀번호 직접 로그인(requests)은 막혔다. 사람이 1회 로그인한 **세션 쿠키**를 재사용한다. 발행/조회에 필요한 쿠키는 `tistory.com` 도메인의 다음들이다:

| 쿠키 | 역할 |
|---|---|
| `TSSESSION` | 핵심 세션 토큰 |
| `__T_`, `__T_SECURE` | 티스토리 인증 |
| `IS_TC`, `_T_ANO` | 보조 |

- **CSRF 토큰 헤더는 없다.** `origin` + `referer` + 세션 쿠키로 인증된다(SameSite 방어).
- 쿠키 추출은 [auth-and-secrets.md](./auth-and-secrets.md) 참고. `lib/tistory.ts`의 `buildCookieHeader`가 storage_state에서 자동 추출한다.

## 발행 — `POST /manage/post.json`

`https://{blog}.tistory.com/manage/post.json`

**요청 헤더**
```
content-type: application/json
accept: application/json, text/plain, */*
origin:  https://{blog}.tistory.com
referer: https://{blog}.tistory.com/manage/newpost
cookie:  __T_=1; __T_SECURE=1; TSSESSION=...; IS_TC=0; _T_ANO=...
```

**요청 본문(JSON)**

| 필드 | 값 / 의미 |
|---|---|
| `id` | `"0"` = 새 글 (수정 시 글 ID) |
| `title` | 제목 |
| `content` | **본문 HTML** (마크다운 아님 — 에디터가 전송 직전 HTML로 변환) |
| `slogan` | 글 주소(slug) |
| `visibility` | **20=공개 · 15=보호 · 0=비공개** |
| `category` | 카테고리 ID (`0`=없음) |
| `tag` | 쉼표 구분 문자열 `"a,b"` |
| `published` | `1`=발행 (`0`=임시저장) |
| `type` | `"post"` |
| `attachments` | `[]` |
| `recaptchaValue` | `""` (빈값으로도 발행 성공 — 캡차 미트리거) |
| `cclCommercial`, `cclDerive`, `uselessMarginForEntry`, `draftSequence` | 부가/기본값 |

**응답**: `{ "entryUrl": "https://{도메인}/entry/<slug>" }` (커스텀 도메인이 있으면 그 도메인으로 반환된다.)

> `content`가 HTML이라 마크다운 입력은 `marked`로 변환해 넣는다(`lib/markdown.ts`). `data-ke-size` 같은 에디터 전용 단락 속성은 없어도 표준 HTML이면 받아들인다.

## 목록 — `GET /manage/posts.json`

`https://{blog}.tistory.com/manage/posts.json?category=-3&page={N}&searchKeyword=&searchType=title&visibility={all|public|private|protected}`

**응답**
```json
{ "count": 15, "totalCount": 177, "items": [ {
  "id": "181",                      // 티스토리 postId = 블로그 번호
  "title": "...", "slogan": "<slug>",
  "visibility": "PUBLIC",           // PUBLIC | PRIVATE | PROTECTED
  "category": "AI 지식", "categoryId": "830108",
  "published": "2026-05-26 15:58", "modified": "...",
  "permalink": "https://{도메인}/entry/...", "countOfComments": "0"
} ] }
```

- 페이지당 **15개**, `totalCount`로 전체 페이지 수를 계산해 순회한다(`actions/list.ts`).
- `id`가 곧 **티스토리 postId = 블로그 번호**. 외부 번호↔파일 매핑의 정본이다.

## 카테고리 — `GET /manage/category/simple.json`

`{ "categories": [ { "id": 811911, "name": "...", "entries": 168, ... }, ... ] }`

발행 시 `category`는 ID로 받는다. 이름→ID 해결에 이 엔드포인트를 쓴다.

## 그 밖에 관측된 엔드포인트

| 엔드포인트 | 용도 |
|---|---|
| `POST /manage/autosave` | 자동저장 → `{"success":true}` |
| `POST /manage/dkaptcha/widgetId` | 캡차 위젯 (정상 발행에선 미사용) |

## 재캡처 (깨질 때)

엔드포인트/페이로드가 바뀌어 실패하면:
1. `node scripts/capture-session.mjs ./state.json` 로 로그인 세션을 다시 받고,
2. 같은 방식으로 글쓰기→발행을 한 번 수행하며 네트워크(HAR)를 캡처해,
3. 위 표(헤더/본문 필드/응답)를 갱신하고 `lib/tistory.ts`·`actions/*`를 맞춘다.

비공식 계약이므로 이 문서가 **무엇을 다시 확인해야 하는지**의 체크리스트 역할을 한다.
