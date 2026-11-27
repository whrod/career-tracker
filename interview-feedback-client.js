(() => {
 const panel = document.querySelector('#interview-feedback');
 const tab = document.querySelector('#interview-feedback-tab');
 const find = selector => panel.querySelector(selector);
 const gate = find('#feedback-gate');
 const gateStatus = find('#feedback-gate-status');
 const signIn = find('#feedback-sign-in');
 const retry = find('#feedback-retry');
 const unlockForm = find('#feedback-unlock-form');
 const password = find('#feedback-password');
 const lockButton = find('#feedback-lock-button');
 const workspace = find('#feedback-workspace');
 const actionStatus = find('#feedback-action-status');
 const recordings = find('#feedback-recordings');
 const driveStatus = find('#feedback-drive-status');
 const driveFolder = find('#feedback-drive-folder');
 const driveSignIn = find('#feedback-drive-sign-in');
 const refreshRecordings = find('#feedback-refresh');
 const reportsList = find('#feedback-reports');
 const reportsStatus = find('#feedback-reports-status');
 const refreshReports = find('#feedback-refresh-reports');
 const uploadForm = find('#feedback-upload-form');
 const audioInput = find('#feedback-audio');
 const audioPlayer = find('#feedback-upload-player');
 const uploadHint = find('#feedback-upload-hint');
 const transcriptForm = find('#feedback-transcript-form');
 const titleInput = find('#feedback-report-title');
 const analysisStatus = find('#feedback-analysis-status');
 const codexCopy = find('#feedback-codex-copy');
 const copyText = find('#feedback-copy-text');

 let accessVersion = 0;
 let reportsVersion = 0;
 let accessRequest;
 let dataRequest;
 let unlocked = false;
 let locking = false;
 let analysisRunning = false;
 let audioPreviewUrl;
 let drive = {};
 let reports = [];
 const defaultAudioLimit = 24 * 1024 * 1024;

 async function request(endpoint, {body, signal} = {}) {
  const upload = body instanceof FormData;
  const response = await fetch('/api/interview-feedback/' + endpoint, {
   method: body === undefined ? 'GET' : 'POST',
   headers: body === undefined || upload ? undefined : {'Content-Type': 'application/json'},
   body: body === undefined || upload ? body : JSON.stringify(body),
   cache: 'no-store',
   signal
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
   const error = new Error(result?.error || '서버 응답을 확인하지 못했습니다. 다시 시도해 주세요.');
   error.status = response.status;
   throw error;
  }
  return result;
 }

 function trustedLink(link, allowed) {
  try {
   const url = new URL(link, location.origin);
   return allowed(url) ? url.href : '';
  } catch {
   return '';
  }
 }

 const driveLink = link => trustedLink(link, url => url.protocol === 'https:' && url.hostname === 'drive.google.com');
 const signInLink = link => trustedLink(link, url => url.origin === location.origin && url.pathname === '/signin-with-chatgpt');

 function displayLink(element, url) {
  element.hidden = !url;
  if (url) element.href = url;
  else element.removeAttribute('href');
 }

 function status(element, message, error = false) {
  element.textContent = message;
  element.hidden = !message;
  element.classList.toggle('error', error);
 }

 function dropPreview() {
  audioPlayer.pause();
  if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
  audioPreviewUrl = undefined;
  audioPlayer.hidden = true;
  audioPlayer.removeAttribute('src');
 }

 function clearWorkspace() {
  dataRequest?.abort();
  unlocked = false;
  analysisRunning = false;
  workspace.hidden = true;
  lockButton.hidden = true;
  drive = {};
  reports = [];
  uploadForm.reset();
  transcriptForm.reset();
  titleInput.value = '';
  copyText.value = '';
  copyText.hidden = true;
  transcriptForm.querySelector('details').open = false;
  dropPreview();
  recordings.replaceChildren();
  reportsList.replaceChildren();
  displayLink(driveFolder, '');
  displayLink(driveSignIn, '');
  [actionStatus, driveStatus, reportsStatus, analysisStatus].forEach(element => status(element, ''));
 }

 function showGate(message, {login = '', unlock = false, retryAction, error = false} = {}) {
  gate.hidden = false;
  status(gateStatus, message, error);
  displayLink(signIn, signInLink(login));
  unlockForm.hidden = !unlock;
  retry.hidden = !retryAction;
  retry.onclick = retryAction || null;
 }

 function beginAccessAttempt() {
  accessRequest?.abort();
  accessRequest = new AbortController();
  return {version: ++accessVersion, signal: accessRequest.signal};
 }

 function openWorkspace() {
  dataRequest = new AbortController();
  unlocked = true;
  gate.hidden = true;
  workspace.hidden = false;
  lockButton.hidden = false;
  refreshRecordings.disabled = false;
  refreshReports.disabled = false;
  updateAnalysisControls();
  loadRecordings();
  loadReports();
 }

 async function checkSession() {
  if (unlocked || locking) return;
  const {version, signal} = beginAccessAttempt();
  showGate('접근 권한을 확인하는 중입니다.');
  try {
   const result = await request('session', {signal});
   if (version !== accessVersion) return;
   if (result.signInUrl) {
    showGate('이관사 소유자 계정으로 로그인해 주세요.', {login: result.signInUrl});
   } else if (result.authenticated === false) {
    showGate('이 계정에는 면접 피드백 열람 권한이 없습니다.');
   } else if (!result.configured) {
    showGate('면접 피드백 잠금 설정을 사용할 수 없습니다.', {retryAction: checkSession, error: true});
   } else if (result.unlocked) {
    openWorkspace();
   } else {
    showGate('비밀번호를 입력하면 녹음과 피드백을 열 수 있습니다.', {unlock: true});
   }
  } catch (error) {
   if (version === accessVersion) showGate(error.message, {retryAction: checkSession, error: true});
  }
 }

 unlockForm.addEventListener('submit', async event => {
  event.preventDefault();
  const {version, signal} = beginAccessAttempt();
  const button = unlockForm.querySelector('button');
  button.disabled = true;
  status(gateStatus, '비밀번호를 확인하는 중입니다.');
  try {
   const result = await request('unlock', {body: {password: password.value}, signal});
   if (version !== accessVersion) return;
   if (!result.unlocked) throw new Error('잠금을 해제하지 못했습니다. 다시 시도해 주세요.');
   openWorkspace();
   lockButton.focus();
  } catch (error) {
   if (version === accessVersion) {
    status(gateStatus, error.message, true);
    password.focus();
   }
  } finally {
   password.value = '';
   button.disabled = false;
  }
 });

 async function lock() {
  if (locking) return;
  locking = true;
  const {version, signal} = beginAccessAttempt();
  clearWorkspace();
  showGate('면접 피드백을 잠그는 중입니다.');
  try {
   await request('lock', {body: {}, signal});
   if (version !== accessVersion) return;
   showGate('면접 피드백을 잠갔습니다.', {unlock: true});
   password.focus();
  } catch (error) {
   if (version === accessVersion) showGate(error.message, {retryAction: lock, error: true});
  } finally {
   locking = false;
  }
 }

 lockButton.addEventListener('click', lock);

 const dateText = value => {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime())
   ? date.toLocaleString('ko-KR', {timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short'})
   : '';
 };

 const fileSize = bytes => {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024 * 1024) return Math.ceil(size / 1024) + ' KB';
  return (size / (1024 * 1024)).toLocaleString('ko-KR', {maximumFractionDigits: 1}) + ' MB';
 };

 function renderRecordings() {
  recordings.innerHTML = (drive.recordings || []).map(recording => {
   const url = driveLink(recording.webViewLink);
   const saved = reports.find(report => report.recordingId === recording.id);
   const metadata = [dateText(recording.createdAt || recording.modifiedAt), fileSize(recording.size)].filter(Boolean).join(' · ');
   return `<li><div class="recording-name"><strong>${esc(recording.name)}</strong>${metadata ? `<div class="muted">${esc(metadata)}</div>` : ''}</div>
    <div class="feedback-actions">
     ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Drive에서 듣기</a>` : ''}
     ${saved ? `<button type="button" class="btn" data-open-report="${esc(saved.id)}">피드백 보기</button>` : ''}
     ${drive.canAnalyzeAudio && !saved ? `<button type="button" class="btn btn-primary" data-analyze-recording="${esc(recording.id)}" ${analysisRunning ? 'disabled' : ''}>녹음 분석</button>` : ''}
     ${!drive.canAnalyzeAudio && !saved ? `<button type="button" class="btn" data-copy-recording="${esc(recording.id)}">Codex 요청 복사</button>` : ''}
    </div></li>`;
  }).join('');
 }

 async function loadRecordings() {
  const version = accessVersion;
  refreshRecordings.disabled = true;
  status(driveStatus, '녹음 목록을 불러오는 중입니다.');
  try {
   const result = await request('recordings', {signal: dataRequest.signal});
   if (version !== accessVersion) return;
   drive = result;
   displayLink(driveFolder, driveLink(result.folderUrl));
   displayLink(driveSignIn, signInLink(result.signInUrl));
   renderRecordings();
   status(driveStatus, result.driveError || (result.driveAvailable
    ? `${result.recordings.length}개 녹음${result.recordings.length > 0 ? '' : ' · Drive 폴더에 녹음을 추가해 주세요.'}`
    : 'Drive 폴더를 열어 녹음을 확인해 주세요.'), Boolean(result.driveError));
  } catch (error) {
   if (version !== accessVersion) return;
   if (error.status === 401) return sessionExpired();
   status(driveStatus, error.message, true);
  } finally {
   if (version === accessVersion) {
    refreshRecordings.disabled = false;
    updateAnalysisControls();
   }
  }
 }

 function sessionExpired() {
  ++accessVersion;
  clearWorkspace();
  checkSession();
 }

 const lines = text => `<p class="feedback-text">${esc(text)}</p>`;
 const list = values => Array.isArray(values) && values.length ? `<ol>${values.map(value => `<li>${lines(value)}</li>`).join('')}</ol>` : '';

 function renderFeedback(feedback) {
  if (typeof feedback === 'string') return lines(feedback);
  if (!feedback) return '';
  const sections = (feedback.sections || []).map(section => {
   const examples = (section.examples || []).map(example => `<li>
    ${example.timestamp ? `<span class="badge">${esc(example.timestamp)}</span>` : ''}
    ${example.quote ? `<blockquote class="feedback-text">${esc(example.quote)}</blockquote>` : ''}
    ${example.problem ? lines(example.problem) : ''}
    ${example.improvement ? `<p class="muted">개선 예시</p>${lines(example.improvement)}` : ''}
   </li>`).join('');
   return `<section><h4>${esc(section.category)}</h4>${lines(section.assessment)}${examples ? `<ol class="feedback-examples">${examples}</ol>` : ''}</section>`;
  }).join('');
  return `${feedback.summary ? `<h4>총평</h4>${lines(feedback.summary)}` : ''}
   ${feedback.priority?.length ? `<h4>먼저 고칠 점</h4>${list(feedback.priority)}` : ''}
   ${sections}
   ${feedback.rehearsal?.length ? `<h4>다음 면접 연습</h4>${list(feedback.rehearsal)}` : ''}
   ${feedback.limitations ? `<p class="muted feedback-text">${esc(feedback.limitations)}</p>` : ''}`;
 }

 function renderReports(preferredId) {
  const openIds = new Set([...reportsList.querySelectorAll('details[open]')].map(element => element.dataset.feedbackReport));
  if (preferredId) openIds.add(preferredId);
  const sourceLabel = {audio: '녹음', drive: 'Drive 녹음', upload: '녹음', transcript: '전사문', manual: '직접 저장', prepared: '별도 검토'};
  reportsList.innerHTML = reports.map((report, index) => {
   const meta = [sourceLabel[report.source], dateText(report.createdAt)].filter(Boolean).join(' · ');
   const open = openIds.size ? openIds.has(report.id) : index === 0;
   return `<details class="card feedback-report" data-feedback-report="${esc(report.id)}" ${open ? 'open' : ''}>
    <summary>${esc(report.title || '면접 피드백')}${meta ? ` <span class="muted">· ${esc(meta)}</span>` : ''}</summary>
    <div class="feedback-report-body">${renderFeedback(report.feedback)}</div></details>`;
  }).join('');
  status(reportsStatus, reports.length ? '' : '저장된 면접 피드백이 없습니다.');
 }

 function showReport(id) {
  const detail = [...reportsList.children].find(element => element.dataset.feedbackReport === id);
  if (!detail) return;
  detail.open = true;
  if (panel.classList.contains('active')) detail.querySelector('summary').focus();
 }

 async function loadReports() {
  const version = accessVersion;
  const generation = ++reportsVersion;
  refreshReports.disabled = true;
  status(reportsStatus, '저장된 피드백을 불러오는 중입니다.');
  try {
   const result = await request('reports', {signal: dataRequest.signal});
   if (version !== accessVersion || generation !== reportsVersion) return;
   reports = result.reports;
   renderReports();
   renderRecordings();
  } catch (error) {
   if (version !== accessVersion || generation !== reportsVersion) return;
   if (error.status === 401) return sessionExpired();
   status(reportsStatus, error.message, true);
  } finally {
   if (version === accessVersion) refreshReports.disabled = false;
  }
 }

 refreshRecordings.addEventListener('click', loadRecordings);
 refreshReports.addEventListener('click', loadReports);

 function updateAnalysisControls() {
  const audioLimit = fileSize(drive.audioMaxBytes || defaultAudioLimit);
  uploadHint.textContent = drive.canUploadAudio
   ? `Drive에서 내려받은 녹음 파일을 선택하세요. 최대 ${audioLimit}입니다.`
   : 'Drive에서 내려받은 녹음 파일을 선택하면 이 기기에서 미리 들을 수 있습니다.';
  uploadForm.querySelector('button').hidden = !drive.canUploadAudio;
  uploadForm.querySelector('button').disabled = analysisRunning || !drive.canUploadAudio;
  transcriptForm.hidden = !drive.analysisAvailable;
  transcriptForm.querySelector('button').disabled = analysisRunning || !drive.analysisAvailable;
  recordings.querySelectorAll('[data-analyze-recording]').forEach(button => {button.disabled = analysisRunning;});
  codexCopy.hidden = !!drive.canAnalyzeAudio;
  status(analysisStatus, drive.analysisAvailable || drive.canUploadAudio ? ''
   : '이관사에서 자동 분석을 사용할 수 없습니다. Codex 분석 요청을 복사해 채팅에 붙여넣으세요.');
 }

 async function analyze(body) {
  if (analysisRunning) return false;
  const version = accessVersion;
  analysisRunning = true;
  updateAnalysisControls();
  status(actionStatus, '면접을 분석하는 중입니다. 피드백이 준비되면 자동으로 저장합니다.');
  try {
   const result = await request('analyze', {body, signal: dataRequest.signal});
   if (version !== accessVersion) return false;
   ++reportsVersion;
   reports = [result.report, ...reports.filter(report => report.id !== result.report.id)];
   renderReports(result.report.id);
   renderRecordings();
   status(actionStatus, '면접 피드백을 저장했습니다.');
   showReport(result.report.id);
   return true;
  } catch (error) {
   if (version !== accessVersion) return false;
   if (error.status === 401) sessionExpired();
   else status(actionStatus, error.message, true);
   return false;
  } finally {
   if (version === accessVersion) {
    analysisRunning = false;
    updateAnalysisControls();
   }
  }
 }

 recordings.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button?.dataset.openReport) showReport(button.dataset.openReport);
  if (button?.dataset.analyzeRecording) analyze({recordingId: button.dataset.analyzeRecording, title: titleInput.value.trim()});
  if (button?.dataset.copyRecording) {
   const recording = drive.recordings.find(item => item.id === button.dataset.copyRecording);
   if (recording) copyCodexRequest(recording);
  }
 });

 async function copyCodexRequest(recording) {
  const version = accessVersion;
  const folder = driveLink(drive.folderUrl);
  const selected = recording?.name || audioInput.files[0]?.name;
  const title = titleInput.value.trim();
  const locationHint = folder ? `Drive 폴더 ${folder}` : '이관사에 연결된 Drive 면접 녹음 폴더';
  const fileHint = selected ? `의 ‘${selected}’ 녹음` : '의 가장 최근 면접 녹음';
  const prompt = [`${locationHint}${fileHint}을 듣고 한국어로 솔직하게 피드백해줘.`,
   title ? `면접 제목은 ‘${title}’이야.` : '',
   '지원자의 말투와 전달력, 질문에 반응하는 태도, 답변 내용과 구체성을 각각 평가해줘. 녹음에서 확인한 시각과 발언을 근거로 먼저 고칠 점, 더 나은 답변 예시, 다음 면접 연습을 제안해줘. 확인하기 어려운 부분은 표시해줘.',
   '완성한 피드백은 이관사 면접 피드백 탭에 저장해줘.'].filter(Boolean).join('\n');
  try {
   await navigator.clipboard.writeText(prompt);
   if (version === accessVersion) {
    copyText.hidden = true;
    copyText.value = '';
    status(actionStatus, '요청을 복사했습니다. Codex 채팅에 붙여넣으세요.');
   }
  } catch {
   if (version !== accessVersion) return;
   codexCopy.hidden = false;
   copyText.value = prompt;
   copyText.hidden = false;
   copyText.select();
   status(actionStatus, '선택된 요청 문구를 복사해 Codex 채팅에 붙여넣으세요.');
  }
 }

 find('#feedback-copy-button').addEventListener('click', () => copyCodexRequest());

 audioInput.addEventListener('change', () => {
  dropPreview();
  const file = audioInput.files[0];
  if (!file) return;
  audioPreviewUrl = URL.createObjectURL(file);
  audioPlayer.src = audioPreviewUrl;
  audioPlayer.hidden = false;
 });

 uploadForm.addEventListener('submit', event => {
  event.preventDefault();
  const file = audioInput.files[0];
  if (!file || !drive.canUploadAudio) return;
  const limit = drive.audioMaxBytes || defaultAudioLimit;
  if (file.size > limit) {
   status(actionStatus, `파일은 ${fileSize(limit)} 이하로 올려 주세요.`, true);
   return;
  }
  const body = new FormData();
  body.append('audio', file);
  body.append('title', titleInput.value.trim() || file.name.slice(0, 160));
  analyze(body);
 });

 transcriptForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!drive.analysisAvailable) return;
  const title = titleInput.value.trim();
  const transcript = find('#feedback-transcript').value.trim();
  if (!transcript) {
   status(actionStatus, '전사문을 입력해 주세요.', true);
   return;
  }
  if (await analyze({title, transcript}) && find('#feedback-transcript').value.trim() === transcript) {
   transcriptForm.reset();
   if (titleInput.value.trim() === title) titleInput.value = '';
  }
 });

 tab.addEventListener('click', checkSession);
 const selectTabFromUrl = () => {
  if (location.hash === '#interview-feedback' || (!location.hash && new URLSearchParams(location.search).get('tab') === 'interview-feedback')) tab.click();
 };
 window.addEventListener('hashchange', selectTabFromUrl);
 window.addEventListener('pageshow', event => {
  if (event.persisted && unlocked) sessionExpired();
 });
 selectTabFromUrl();
})();

