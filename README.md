# GamePlanner

AI 기반 모바일 게임 기획서 작성 및 게임 분석 데스크톱 애플리케이션 (v0.2.3)

Google Gemini AI와의 대화를 통해 개발자가 즉시 착수할 수 있는 수준의 게임 기획서를 생성하고, 기존 게임에 대한 심층 분석 보고서를 자동으로 작성합니다.

---

## 핵심 기능

### 1. AI 게임 기획서 작성 (Planning)
- Gemini AI와 대화하며 **하이퍼 캐주얼 / 하이브리드 캐주얼** 장르의 게임 기획서를 단계적으로 작성
- 실시간 마크다운 프리뷰로 기획서 내용 즉시 확인
- 커스텀 프롬프트 템플릿 지원으로 기획서 양식 자유 편집

### 2. 게임 분석 보고서 (Analysis)
- 게임명 입력만으로 Google Search 기반 최신 정보 수집 및 체계적 분석
- 시장 현황, 수익 모델, 핵심 메커니즘 등을 포함한 종합 분석 보고서 자동 생성

### 3. 게임 이미지 수집 (Collection)
- DuckDuckGo, Steam, Google Play에서 게임 스크린샷/프로모션 이미지 자동 검색 및 다운로드
- 로컬 폴더에 자동 정리 및 저장

### 4. Notion 연동
- 작성된 기획서/분석 보고서를 Notion 데이터베이스로 원클릭 내보내기
- 기획용/분석용 Notion DB 별도 설정 가능

### 5. 문서 관리
- **버전 관리**: 기획서 작성 시점별 버전 스냅샷 저장 및 이력 조회
- **체크리스트**: 기획서 완성도 검증을 위한 체크리스트
- **참조 파일**: 기획 세션별 참고 자료 관리
- **내보내기**: 마크다운 파일 다운로드, 클립보드 복사

### 6. 기타
- Google OAuth 인증
- 자동 업데이트 (Tauri Updater)
- 세션 자동 저장
- 리사이즈 가능한 3컬럼 레이아웃 (사이드바 / 채팅 / 프리뷰)

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| **데스크톱 프레임워크** | Tauri v2 (Rust 백엔드) |
| **프론트엔드** | React 19 + TypeScript |
| **빌드 도구** | Vite |
| **스타일링** | TailwindCSS |
| **상태 관리** | Zustand (슬라이스 패턴) |
| **AI** | Google Gemini API (Flash 모델, 스트리밍) |
| **마크다운** | react-markdown, remark-gfm, rehype-raw |
| **리치 텍스트 에디터** | TipTap |
| **외부 연동** | Notion API |
| **아이콘** | Lucide React |
| **날짜 처리** | date-fns |
| **Tauri 플러그인** | fs, dialog, http, store, updater, opener, deep-link, process |

---

## 프로젝트 구조

```
src/
├── components/       # UI 컴포넌트
│   ├── ChatPanel       # AI 대화 패널
│   ├── MarkdownPreview # 마크다운 미리보기 및 내보내기
│   ├── CollectionPanel # 이미지 수집 패널
│   ├── Sidebar/        # 세션 목록 사이드바
│   ├── TemplateEditor/ # 프롬프트 템플릿 편집기
│   └── ...
├── hooks/            # React 커스텀 훅
│   ├── useMessageHandler  # 메시지 처리 (기획/분석 라우팅)
│   ├── useGameAnalysis    # 게임 분석 로직
│   ├── useCollection      # 이미지 수집 플로우
│   ├── useAutoSave        # 세션 자동 저장
│   └── ...
├── store/            # Zustand 상태 관리
│   ├── useAppStore.ts     # 메인 스토어 (슬라이스 통합)
│   └── slices/            # session, template, settings, ui, checklist, collection
├── lib/              # 핵심 로직
│   ├── services/          # Gemini API, 스토리지, 수집, 인증 서비스
│   ├── constants/         # API, UI 상수
│   ├── utils/             # 유틸리티 함수
│   └── migrations/        # 데이터 마이그레이션
├── types/            # TypeScript 타입 정의
└── assets/           # 정적 리소스
```

---

## 시작하기

### 사전 요구사항
- Node.js
- Rust (Tauri 빌드용)
- [Tauri 개발 환경 설정](https://v2.tauri.app/start/prerequisites/)

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (Tauri + Vite)
npm run tauri dev

# 프론트엔드만 실행
npm run dev

# 프로덕션 빌드
npm run tauri build
```

### 필수 설정
- **Gemini API Key**: 설정 모달에서 Google Gemini API 키 입력
- **Notion 연동** (선택): Notion API 키 및 데이터베이스 ID 설정

---

## 추천 IDE 설정

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
