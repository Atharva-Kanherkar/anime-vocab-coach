import type { N5Answer, N5Script } from "../../shared/n5/contracts";
// Explicit answer oracle, independent of the grader's private keys.
export function correctAnswers(script: N5Script = "romaji"): N5Answer[] {
  return [
    { questionId: "greeting", value: "b" }, { questionId: "name", value: "a" },
    { questionId: "question", value: "c" }, { questionId: "friend", value: "b" },
    { questionId: "student", value: "c" }, { questionId: "thanks", value: "a" },
    { questionId: "morning", value: "b" }, { questionId: "read", value: "c" },
    { questionId: "write-name", value: script === "romaji" ? "Haru desu" : "ハルです" },
    { questionId: "write-greeting", value: script === "romaji" ? "Hajimemashite" : "はじめまして" },
  ];
}
