# METANET AI Assistant Frontend

자연어 대화형 사내 업무지원 AI 어시스턴트 프론트엔드 프로젝트입니다.

직원이 Web Chat UI에서 자연어로 회의실 예약, 방문객 주차 등록, 구내식당 정보 확인, 비품 신청, 사내 규정 검색 등의 업무를 처리할 수 있도록 하는 것을 목표로 합니다.

## 기술 스택

- Vue 3
- Vite
- Vue Router
- Pinia
- Axios
- JavaScript
- CSS

## 실행 환경

아래 버전 이상 사용을 권장합니다.

- Node.js 20 이상
- npm 10 이상

Node.js와 npm 버전은 아래 명령어로 확인할 수 있습니다.

```bash
node -v
npm -v
```

## 프로젝트 실행 방법

### 1. 저장소 클론

```bash
git clone <repository-url>
cd workspace-Final-Front
```

`<repository-url>` 부분에는 GitHub 저장소 주소를 입력합니다.

예시:

```bash
git clone https://github.com/사용자명/레포지토리명.git
cd workspace-Final-Front
```

### 2. 패키지 설치

프로젝트 루트 경로에서 아래 명령어를 실행합니다.

```bash
npm install
```

`npm install`을 실행하면 `package.json`과 `package-lock.json`을 기준으로 프로젝트 실행에 필요한 패키지가 한 번에 설치됩니다.

팀원 간 동일한 의존성 버전으로 설치하고 싶다면 아래 명령어를 사용할 수도 있습니다.

```bash
npm ci
```

일반 개발 환경에서는 `npm install`을 사용하면 됩니다.

### 3. 개발 서버 실행

```bash
npm run dev
```

실행 후 터미널에 표시되는 주소로 접속합니다.

기본 주소는 보통 아래와 같습니다.

```txt
http://localhost:5173
```

브라우저에서 해당 주소로 접속하면 로그인 화면을 확인할 수 있습니다.

## 빌드 방법

배포용 정적 파일을 생성하려면 아래 명령어를 실행합니다.

```bash
npm run build
```

빌드 결과물은 `dist/` 폴더에 생성됩니다.

## 빌드 결과 미리보기

빌드된 결과물을 로컬에서 미리 실행하려면 아래 명령어를 사용합니다.

```bash
npm run preview
```

## 주요 명령어 정리

| 명령어 | 설명 |
| --- | --- |
| `npm install` | 프로젝트 실행에 필요한 패키지를 설치합니다. |
| `npm run dev` | 개발 서버를 실행합니다. |
| `npm run build` | 배포용 빌드 파일을 생성합니다. |
| `npm run preview` | 빌드된 결과물을 로컬에서 미리 확인합니다. |

## 현재 구현 상태

- 로그인 페이지 UI 구현
- 로그인 버튼 클릭 시 채팅 페이지 이동
- 채팅 메인 UI 구현
- 채팅방 목록 표시
- 새 대화 시작 기능
- 사이드바 접기 / 펼치기 기능
- 채팅방 목록 스크롤 처리
- 오늘의 업무 바로가기 패널
- 자주 묻는 업무 빠른 질문
- 챗봇 SVG 로고 적용
- Mock 데이터 기반 채팅 응답 처리

## 프로젝트 구조

```txt
src/
├─ api/
│  ├─ authApi.js
│  ├─ chatApi.js
│  └─ client.js
├─ assets/
│  └─ images/
│     ├─ chatbot-logo.svg
│     └─ login-logo.svg
├─ components/
│  ├─ chat/
│  ├─ common/
│  └─ login/
├─ constants/
├─ router/
├─ stores/
├─ styles/
├─ utils/
└─ views/
   ├─ ChatView.vue
   └─ LoginView.vue
```

## 참고 사항

`node_modules/`, `dist/`, `.env` 파일은 Git에 포함하지 않습니다.

필요한 패키지 정보는 `package.json`과 `package-lock.json`에 기록되어 있으므로, 프로젝트를 새로 받은 팀원은 `npm install`만 실행하면 됩니다.