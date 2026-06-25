<?php
header("Content-Type: application/json; charset=UTF-8");

$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

if (!$data) {
  echo json_encode([
    "success" => false,
    "answer" => "入力データを読み込めませんでした。",
    "mood" => "normal"
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

$suspect = $data["suspect"] ?? "";
$evidence = $data["evidence"] ?? "none";
$question = $data["question"] ?? "";

$suspectNames = [
  "sato" => "佐藤",
  "tanaka" => "田中",
  "suzuki" => "鈴木"
];

$evidenceNames = [
  "none" => "なし",
  "accessLog" => "アクセスログ",
  "chatLog" => "チャット履歴",
  "usb" => "USBメモリ"
];

$suspectName = $suspectNames[$suspect] ?? "不明";
$evidenceName = $evidenceNames[$evidence] ?? "なし";

/*
  표정은 AI가 아니라 코드가 결정.
  그래야 타나카가 아무 증거에나 무서워하지 않음.
*/
$mood = "normal";

if ($suspect === "tanaka" && $evidence === "accessLog") {
  $mood = "nervous";
}

if ($suspect === "suzuki" && $evidence === "usb") {
  $mood = "nervous";
}

$characterSetting = "";

if ($suspect === "sato") {
  $characterSetting = "
あなたは佐藤です。
役割：チームリーダー。
性格：落ち着いていて責任感がある。
事実：犯人ではない。田中にバックエンド修正を頼んだが、ファイル削除は指示していない。
話し方：冷静で丁寧。
";
} else if ($suspect === "tanaka") {
  $characterSetting = "
あなたは田中です。
役割：バックエンド担当。
性格：少し防御的。追及されると焦る。
事実：実は23:12に共有フォルダへログインし、23:16にmain_project.zipを削除した。
動機：バックエンドの問題を隠すため。
重要ルール：最初から完全自白してはいけない。
アクセスログを提示された場合だけ、少し動揺して一部を認める。
チャット履歴だけでは強く動揺しない。
USBメモリだけでは知らないふりをする。
話し方：言い訳が多いが、完全には認めない。
";
} else if ($suspect === "suzuki") {
  $characterSetting = "
あなたは鈴木です。
役割：デザイン担当。
性格：慎重で少し不安そう。
事実：犯人ではない。田中が遅くまで作業していたことを見ている。USBに何かをコピーしていた可能性も見ている。
話し方：控えめで、断定を避ける。
";
} else {
  $characterSetting = "あなたは事件の関係者です。";
}

$prompt = "
あなたはテキスト推理ゲーム『消えた提出ファイル』の容疑者役です。

事件：
卒業制作の提出直前、共有フォルダから main_project.zip が削除された。

事件の真実：
田中が23:12に共有フォルダへログインし、23:16に main_project.zip を削除した。
動機は、バックエンドの問題を隠すため。

現在の容疑者：
{$suspectName}

容疑者設定：
{$characterSetting}

プレイヤーが提示した証拠：
{$evidenceName}

プレイヤーの質問：
{$question}

返答ルール：
- 日本語で答える
- 1〜3文で短く答える
- ゲームの真実と矛盾する新しい設定を作らない
- 田中の場合、すぐに完全自白しない
- 証拠が弱い場合は否定または回避する
- キャラクターらしく自然に返答する
";

$requestBody = [
  "model" => "gemma3:1b",
  "prompt" => $prompt,
  "stream" => false,
  "options" => [
    "temperature" => 0.7,
    "num_predict" => 160
  ]
];

$ch = curl_init("http://localhost:11434/api/generate");

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestBody));
curl_setopt($ch, CURLOPT_TIMEOUT, 60);

$response = curl_exec($ch);
$error = curl_error($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

curl_close($ch);

if ($error || $httpCode >= 400 || !$response) {
  echo json_encode([
    "success" => false,
    "answer" => "ローカルAIの応答取得に失敗しました。Ollamaが起動しているか確認してください。",
    "mood" => "normal",
    "debug" => $error ?: $response
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

$result = json_decode($response, true);

$answer = $result["response"] ?? "";

if (trim($answer) === "") {
  $answer = "……すみません、うまく答えられません。";
}

echo json_encode([
  "success" => true,
  "answer" => trim($answer),
  "mood" => $mood
], JSON_UNESCAPED_UNICODE);