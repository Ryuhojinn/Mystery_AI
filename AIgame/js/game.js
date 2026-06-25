let currentSuspect = "";
let currentEvidence = "none";

let questionCount = 0;
let hintCount = 0;

const MAX_QUESTIONS = 8;
const MAX_HINTS = 3;

const usedEvidenceToSuspect = {
  sato: new Set(),
  tanaka: new Set(),
  suzuki: new Set()
};

const suspectNames = {
  sato: "佐藤",
  tanaka: "田中",
  suzuki: "鈴木"
};

const evidenceNames = {
  none: "なし",
  accessLog: "アクセスログ",
  chatLog: "チャット履歴",
  usb: "USBメモリ"
};

const evidenceDetails = {
  none: "証拠は選択されていません。",
  accessLog: "23:12 田中のアカウントで共有フォルダにログイン。23:16 main_project.zip が削除されている。",
  chatLog: "田中「まだバックエンドに少し問題がある」 佐藤「明日の朝までに提出するから、今夜中に直して」",
  usb: "削除されたはずの main_project.zip のバックアップファイルが残っている。"
};

const suspectImages = {
  sato: {
    normal: "images/sato_normal.png",
    nervous: "images/sato_nervous.png"
  },
  tanaka: {
    normal: "images/tanaka_normal.png",
    nervous: "images/tanaka_nervous.png"
  },
  suzuki: {
    normal: "images/suzuki_normal.png",
    nervous: "images/suzuki_nervous.png"
  }
};

window.onload = function () {
  updateStatus();
  updateCollectedEvidenceList();

  const characterImage = document.getElementById("characterImage");

  characterImage.onerror = function () {
    if (!characterImage.src.includes("unknown.png")) {
      characterImage.src = "images/unknown.png";
    }
  };

  renderSystemMessage(`
    卒業制作の提出直前、共有フォルダから重要なファイルが削除された。<br>
    右側から容疑者を選び、質問してください。
  `);
};

function selectSuspect(suspect) {
  currentSuspect = suspect;
  currentEvidence = "none";

  document.getElementById("currentSuspect").textContent = suspectNames[suspect];
  document.getElementById("currentEvidence").textContent = "なし";
  document.getElementById("evidenceDetail").textContent = evidenceDetails.none;
  document.getElementById("speakerName").textContent = suspectNames[suspect];

  setCharacterImage(suspect, "normal");

  appendSystemMessage(`
    ${suspectNames[suspect]}を選択しました。<br>
    気になることを質問してください。
  `);
}

function selectEvidence(evidence) {
  document.getElementById("speakerName").textContent = "SYSTEM";

  if (currentSuspect === "") {
    currentEvidence = "none";

    document.getElementById("currentEvidence").textContent = "なし";
    document.getElementById("evidenceDetail").textContent = "先に容疑者を選んでください。";

    appendSystemMessage(`
      先に容疑者を選んでください。<br>
      証拠は、容疑者1人につき1回だけ提示できます。
    `);
    return;
  }

  if (evidence === "none") {
    currentEvidence = "none";

    document.getElementById("currentEvidence").textContent = "なし";
    document.getElementById("evidenceDetail").textContent = evidenceDetails.none;

    appendSystemMessage(`
      証拠を使わずに、${suspectNames[currentSuspect]}に質問できます。
    `);
    return;
  }

  if (usedEvidenceToSuspect[currentSuspect].size >= 1) {
    currentEvidence = "none";

    document.getElementById("currentEvidence").textContent = "なし";
    document.getElementById("evidenceDetail").textContent = evidenceDetails.none;

    appendSystemMessage(`
      ${suspectNames[currentSuspect]}には、すでに証拠を提示しています。<br>
      同じ容疑者に2つ目の証拠を提示することはできません。
    `);
    return;
  }

  currentEvidence = evidence;

  document.getElementById("currentEvidence").textContent = evidenceNames[evidence];
  document.getElementById("evidenceDetail").textContent = evidenceDetails[evidence];

  appendSystemMessage(`
    証拠「${evidenceNames[evidence]}」を選択しました。<br>
    この証拠を使って、${suspectNames[currentSuspect]}に質問できます。
  `);
}

async function askQuestion() {
  if (questionCount >= MAX_QUESTIONS) {
    alert("質問回数が上限に達しました。最終推理をしてください。");
    lockQuestionInput();
    return;
  }

  const questionInput = document.getElementById("questionInput");
  const question = questionInput.value.trim();

  if (currentSuspect === "") {
    alert("先に容疑者を選んでください。");
    return;
  }

  if (question === "") {
    alert("質問を入力してください。");
    return;
  }

  const askedSuspect = currentSuspect;
  const usedEvidence = currentEvidence;

  if (
    usedEvidence !== "none" &&
    usedEvidenceToSuspect[askedSuspect].size >= 1
  ) {
    alert("この容疑者には、すでに証拠を提示しています。証拠なしで質問するか、別の容疑者を選んでください。");
    resetEvidenceAfterQuestion();
    return;
  }

  questionCount++;

  if (usedEvidence !== "none") {
    usedEvidenceToSuspect[askedSuspect].add(usedEvidence);
    updateCollectedEvidenceList();
  }

  document.getElementById("speakerName").textContent = suspectNames[askedSuspect];

  appendDialogue("あなた", question, "player");
  appendSystemMessage("回答を待っています。");

  questionInput.value = "";
  document.getElementById("askButton").disabled = true;

  let answer = "";
  let mood = "normal";

  try {
    const aiResult = await getAIAnswer(askedSuspect, usedEvidence, question);

    if (aiResult.success) {
      answer = aiResult.answer;
      mood = aiResult.mood;
    } else {
      answer = getAnswer(askedSuspect, usedEvidence, question);
      mood = getFallbackMood(askedSuspect, usedEvidence);
    }
  } catch (error) {
    console.error(error);
    answer = getAnswer(askedSuspect, usedEvidence, question);
    mood = getFallbackMood(askedSuspect, usedEvidence);
  }

  setCharacterImage(askedSuspect, mood);
  document.getElementById("speakerName").textContent = suspectNames[askedSuspect];
  appendDialogue(suspectNames[askedSuspect], answer, "npc");

  resetEvidenceAfterQuestion();
  updateStatus();

  if (questionCount < MAX_QUESTIONS) {
    document.getElementById("askButton").disabled = false;
  }

  if (questionCount >= MAX_QUESTIONS) {
    lockQuestionInput();

    setTimeout(function () {
      appendSystemMessage("質問回数が上限に達しました。右上の「最終推理」から答えを提出してください。");
    }, 300);
  }
}

function getAnswer(suspect, evidence, question) {
  setCharacterImage(suspect, "normal");

  if (suspect === "sato") {
    if (evidence === "chatLog") {
      return "確かに田中さんには、バックエンドの修正をお願いしていました。でも、ファイルを削除しろとは言っていません。";
    }

    if (evidence === "accessLog") {
      return "ログを見る限り、私のアカウントではなく田中さんのアカウントでログインされていますね。私はその時間、提出内容の確認をしていました。";
    }

    if (evidence === "usb") {
      return "そのUSBメモリについては知りません。私は共有フォルダ上のファイルだけを確認していました。";
    }

    return "私はチームリーダーとして提出前の確認をしていただけです。ファイルを削除する理由はありません。";
  }

  if (suspect === "tanaka") {
    if (evidence === "accessLog") {
      setCharacterImage("tanaka", "nervous");
      return "……確かにログインはしました。でも、ログインしただけで、削除したとは限らないですよね。";
    }

    if (evidence === "chatLog") {
      setCharacterImage("tanaka", "normal");
      return "バックエンドに問題があったのは事実です。でも、それは開発中なら普通に起こることです。ファイル削除とは関係ありません。";
    }

    if (evidence === "usb") {
      setCharacterImage("tanaka", "normal");
      return "そのUSBのことは知りません。誰かが置いたものではないですか。";
    }

    setCharacterImage("tanaka", "normal");
    return "その時間は家にいました。共有フォルダにはアクセスしていません。";
  }

  if (suspect === "suzuki") {
    if (evidence === "accessLog") {
      return "ログのことは詳しく分かりません。でも、その時間に田中さんがかなり焦っていたのは覚えています。";
    }

    if (evidence === "chatLog") {
      return "そのチャットは見ました。田中さんはバックエンドの問題で、かなり追い詰められているように見えました。";
    }

    if (evidence === "usb") {
      setCharacterImage("suzuki", "nervous");
      return "USBメモリですか……。実は、田中さんが何かをUSBにコピーしているところを見た気がします。";
    }

    return "詳しいことは分かりません。ただ、田中さんが遅くまで作業していたのは見ました。";
  }

  return "……。";
}

function getFallbackMood(suspect, evidence) {
  if (suspect === "tanaka" && evidence === "accessLog") {
    return "nervous";
  }

  if (suspect === "suzuki" && evidence === "usb") {
    return "nervous";
  }

  return "normal";
}

function showHint() {
  if (hintCount >= MAX_HINTS) {
    alert("ヒントはこれ以上使えません。");
    return;
  }

  hintCount++;

  let hint = "";

  if (currentSuspect === "") {
    hint = "まずは容疑者を選び、証言を集めましょう。特に田中の証言に注目してください。";
  } else if (currentSuspect === "tanaka" && currentEvidence === "none") {
    hint = "田中に決定的な証拠を提示するなら、アクセスログが重要です。";
  } else if (currentSuspect === "tanaka" && currentEvidence === "accessLog") {
    hint = "田中は最初に『アクセスしていない』と言っています。アクセスログとの矛盾が重要です。";
  } else if (currentSuspect === "tanaka" && currentEvidence === "usb") {
    hint = "USBメモリだけでは弱いです。田中に提示する証拠は慎重に選びましょう。";
  } else if (currentSuspect === "suzuki") {
    hint = "鈴木は直接の犯人ではなさそうですが、田中の行動を見ている可能性があります。";
  } else if (currentSuspect === "sato") {
    hint = "佐藤はチームリーダーですが、アクセスログ上では直接削除した証拠がありません。";
  } else {
    hint = "証言と証拠が矛盾している人物を探しましょう。";
  }

  document.getElementById("hintArea").textContent = hint;
  appendSystemMessage(`AIヒント：${hint}`);
  updateStatus();
}

function submitAnswer() {
  const culprit = document.getElementById("culpritSelect").value;
  const reason = document.getElementById("reasonInput").value.trim();
  const resultArea = document.getElementById("resultArea");

  if (culprit === "") {
    alert("犯人を選んでください。");
    return;
  }

  if (reason === "") {
    alert("理由を書いてください。");
    return;
  }

  const score = calculateScore(culprit, reason);
  const rank = getRank(score);
  const collectedText = getCollectedEvidenceText();

  if (culprit === "tanaka" && score >= 80) {
    resultArea.innerHTML = buildResultHtml(
      "true-end",
      "TRUE END：真相解明",
      score,
      rank,
      collectedText,
      `
        田中は23:12に共有フォルダへログインし、23:16にmain_project.zipを削除していました。<br>
        あなたはアクセスログ、証言の矛盾、USBメモリの証拠を結びつけ、事件の真相にたどり着きました。
      `,
      `
        証拠と証言の矛盾を正しく整理できています。<br>
        特に、田中の「アクセスしていない」という証言とアクセスログを比較した点が高評価です。
      `
    );
  } else if (culprit === "tanaka") {
    resultArea.innerHTML = buildResultHtml(
      "normal-end",
      "NORMAL END：犯人特定",
      score,
      rank,
      collectedText,
      `
        犯人は田中で正解です。<br>
        ただし、理由の中で証拠同士のつながりが少し弱いため、完全な真相解明には届きませんでした。
      `,
      `
        犯人の選択は正しいですが、アクセスログ、チャット履歴、USBメモリを組み合わせて説明すると、より説得力のある推理になります。
      `
    );
  } else {
    resultArea.innerHTML = buildResultHtml(
      "bad-end",
      "BAD END：真相未解明",
      score,
      rank,
      collectedText,
      `
        今回の推理では真相にたどり着けませんでした。<br>
        もう一度、田中の証言とアクセスログの内容を比較してみましょう。
      `,
      `
        現在の推理では、証拠と犯人を結びつける根拠が不足しています。<br>
        特に、ログイン時間と削除時間に注目する必要があります。
      `
    );
  }
}

function calculateScore(culprit, reason) {
  let score = 0;

  if (culprit === "tanaka") {
    score += 40;
  }

  if (containsAny(reason, ["田中", "tanaka", "タナカ", "타나카"])) {
    score += 5;
  }

  if (containsAny(reason, ["アクセスログ", "ログ", "log", "로그", "23:12", "23:16"])) {
    score += 20;
  }

  if (containsAny(reason, ["矛盾", "証言", "거짓말", "모순", "증언", "말이 다르"])) {
    score += 15;
  }

  if (containsAny(reason, ["USB", "usb", "バックアップ", "백업"])) {
    score += 10;
  }

  if (containsAny(reason, ["チャット", "chat", "채팅", "バックエンド", "백엔드"])) {
    score += 10;
  }

  if (usedEvidenceToSuspect.tanaka.has("accessLog")) {
    score += 15;
  }

  if (usedEvidenceToSuspect.suzuki.has("usb")) {
    score += 10;
  }

  if (usedEvidenceToSuspect.sato.has("chatLog")) {
    score += 5;
  }

  score -= hintCount * 5;

  if (questionCount <= 5) {
    score += 5;
  }

  if (score > 100) {
    score = 100;
  }

  if (score < 0) {
    score = 0;
  }

  return score;
}

function getRank(score) {
  if (score >= 90) {
    return "S";
  }

  if (score >= 80) {
    return "A";
  }

  if (score >= 65) {
    return "B";
  }

  if (score >= 50) {
    return "C";
  }

  return "D";
}

function containsAny(text, keywords) {
  const lowerText = text.toLowerCase();

  for (let i = 0; i < keywords.length; i++) {
    if (lowerText.includes(keywords[i].toLowerCase())) {
      return true;
    }
  }

  return false;
}

function setCharacterImage(suspect, mood) {
  if (!suspectImages[suspect]) {
    document.getElementById("characterImage").src = "images/unknown.png";
    return;
  }

  document.getElementById("characterImage").src = suspectImages[suspect][mood];
}

function resetEvidenceAfterQuestion() {
  currentEvidence = "none";

  document.getElementById("currentEvidence").textContent = "なし";
  document.getElementById("evidenceDetail").textContent = evidenceDetails.none;
}

function updateStatus() {
  document.getElementById("questionCount").textContent = `${questionCount} / ${MAX_QUESTIONS}`;
  document.getElementById("hintCount").textContent = `${hintCount} / ${MAX_HINTS}`;
}

function updateCollectedEvidenceList() {
  const list = document.getElementById("collectedEvidenceList");

  let html = "";

  for (const suspect in usedEvidenceToSuspect) {
    html += `<li class="note-person"><strong>${suspectNames[suspect]}</strong></li>`;

    if (usedEvidenceToSuspect[suspect].size === 0) {
      html += `<li class="note-empty">└ まだ証拠を提示していません。</li>`;
    } else {
      usedEvidenceToSuspect[suspect].forEach(function (evidence) {
        html += `<li class="note-evidence">└ ✓ ${evidenceNames[evidence]}</li>`;
      });
    }
  }

  list.innerHTML = html;
}

function getCollectedEvidenceText() {
  let result = "";

  for (const suspect in usedEvidenceToSuspect) {
    result += `<strong>${suspectNames[suspect]}</strong>：`;

    if (usedEvidenceToSuspect[suspect].size === 0) {
      result += "なし<br>";
    } else {
      const names = [];

      usedEvidenceToSuspect[suspect].forEach(function (evidence) {
        names.push(evidenceNames[evidence]);
      });

      result += names.join("、") + "<br>";
    }
  }

  return result;
}

function lockQuestionInput() {
  document.getElementById("questionInput").disabled = true;
  document.getElementById("askButton").disabled = true;
}

function openFinalAnswer() {
  document.getElementById("finalModal").style.display = "block";
}

function closeFinalAnswer() {
  document.getElementById("finalModal").style.display = "none";
}

function renderSystemMessage(message) {
  document.getElementById("chatLog").innerHTML = `
    <div class="message system">
      <div class="bubble">${message}</div>
    </div>
  `;
}

function appendSystemMessage(message) {
  const chatLog = document.getElementById("chatLog");

  chatLog.innerHTML += `
    <div class="message system">
      <div class="bubble">${message}</div>
    </div>
  `;

  chatLog.scrollTop = chatLog.scrollHeight;
}

function appendDialogue(speaker, text, type) {
  const chatLog = document.getElementById("chatLog");

  chatLog.innerHTML += `
    <div class="message ${type}">
      <div class="bubble">
        <div class="speaker-label">${speaker}</div>
        ${escapeHtml(text)}
      </div>
    </div>
  `;

  chatLog.scrollTop = chatLog.scrollHeight;
}

function buildResultHtml(type, title, score, rank, collected, story, analysis) {
  return `
    <div class="end-card ${type}">
      <div class="end-title">${title}</div>

      <div class="score-line">
        スコア：${score}点 / ランク：${rank}
      </div>

      <div class="collected-title">提示した証拠</div>
      <p>${collected}</p>

      <p>${story}</p>

      <div class="analysis-title">AI Analysis</div>
      <p>${analysis}</p>
    </div>
  `;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function getAIAnswer(suspect, evidence, question) {
  const controller = new AbortController();

  const timeoutId = setTimeout(function () {
    controller.abort();
  }, 8000);

  try {
    const response = await fetch("php/ai_suspect.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        suspect: suspect,
        evidence: evidence,
        question: question
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error("Local AI request failed");
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

window.selectSuspect = selectSuspect;
window.selectEvidence = selectEvidence;
window.askQuestion = askQuestion;
window.showHint = showHint;
window.openFinalAnswer = openFinalAnswer;
window.closeFinalAnswer = closeFinalAnswer;
window.submitAnswer = submitAnswer;