# Career Tracker

지원 현황, 후속 관리, 지원 후보, 서류 점검, 투두와 플랫폼 프로필을 관리하는 웹 UI 및 Cloudflare Worker API 코드입니다.

## 운영과 저장소

실행 사이트는 기존 Sites 주소에 유지합니다. 이 저장소에는 코드만 공개하며 GitHub Pages로 운영 사이트를 이전하지 않습니다. UI의 상태·메모·체크박스는 Worker의 DB 바인딩으로 연결된 Cloudflare D1에 저장합니다. GitHub 저장소와 로컬 PC가 운영 DB 역할을 하는 것은 아닙니다.

개인 지원 내역, 기업별 메모, 원본 서류, 데이터베이스 덤프, 운영 data.json, 인증 토큰과 환경 설정은 저장소에 포함하지 않습니다. 공개 제출 서류 바로가기 URL은 UI의 공개 링크입니다.

## 코드 구조

- template.html: 관리 화면과 공개 서류 바로가기
- client-extra.js, profiles-client.js, todos-client.js, status-client.js: 입력·저장·필터·변경 이력
- worker.mjs: 상태 조회 및 항목별 저장 API
- build.mjs: HTML과 클라이언트 코드를 묶어 Worker 엔트리포인트 생성
- schema.sql: D1의 career_records 테이블
- data.example.json: 개인 내역이 없는 빈 예시
- scripts/sync-from-workspace.ps1: 로컬 운영 소스에서 허용한 코드만 복사해 동기화

## 빌드

Node.js 20 이상에서 실행합니다.

```sh
cp data.example.json data.json
node build.mjs
```

빌드 결과는 dist/server/index.js입니다. Worker 실행 환경에 DB라는 D1 바인딩과 schema.sql 테이블이 필요합니다. 외부 서비스를 구성하려면 별도의 인증과 접근 제어를 적용해야 합니다. Worker API의 인증 경계는 호스팅 계층에서 제공하며 이 코드에 별도의 로그인 구현이나 키가 들어 있지 않습니다. 이 예시를 인증 없이 인터넷에 배포하지 마세요.

운영 data.json이나 빌드 결과를 Git에 추가하지 마세요. 운영 기록은 DB에서 관리합니다. 빈 예시로 빌드하면 개인 내역이 없는 화면을 만들 수 있습니다.

## 운영 소스 동기화

로컬 이직 작업 폴더에서 체크아웃을 나란히 배치한 환경용입니다.

```powershell
pwsh -NoProfile -File scripts/sync-from-workspace.ps1 -Push
```

이 명령은 명시한 UI·Worker 코드만 복사하고, 개인용 기본 투두 및 운영 기록을 제외한 후 GitHub에 올립니다. 실제 사이트 배포는 기존 Sites 배포 절차로 별도 수행합니다.
