# 全100問の6部構成解説：実装・確認記録

## 基準と変更範囲

- 基準main：54eb5dc66841cf5fce2705f4d967b8da8075104c。
- 未統合の第1段階（cf18521）の品質修正・選択肢シャッフルを含め、その上で全100問の解説を6部構成にしました。
- 100問、ID 1〜100、4択を維持。問題文・選択肢・正解を変更するのは第1段階の15問とQ83の用語の精密化のみです。
- Q83は「個人情報」一般ではなく、個人情報取扱事業者が扱う「個人データ」の第三者提供を問うことを明示しました。
- 長期履歴のキーと形式は維持。既存の正誤を再計算せず、問題IDに対応したまま扱います。今回の改訂前後を区別する履歴の版管理は未実装です。
- 本番Pagesの公開設定は変更しません。mainへの統合前は、正式版の公開内容は変わりません。

## 学習教材としての構成

各問題には次を個別に記述しています。基礎知識の文章は100問で重複していません。

1. ひとことで言うと：専門用語を減らした直感的な導入。最初から表示します。
2. 結論：正解の理由。
3. 基礎知識：用語・英語名・仕組みと条件。
4. 具体例：身近な事例や、適切な問題では数値例。
5. 他の選択肢が違う理由：元の選択肢番号に対応した3つの誤答理由。
6. G検定の重要ポイント：関連知識と混同点。公式シラバスの主題項目番号も表示します。

2〜6はdetails/summaryで折りたたみます。数学も直感的な導入や具体的な状況を先に示し、必要な箇所で数式を説明します。選択肢は表示時にシャッフルし、誤答理由もその時点のA〜Dに対応させます。

## シラバスとの整合の意味

[JDLA公式掲載ページ](https://www.jdla.org/certificate/general/#general_No03)から取得した「シラバス2024・第1.4版」（2026年5月11日）の技術37項目・法律倫理18項目へ、100問すべての主題を対応付けました。`syllabus` に版・分野・項目番号を保存しています。

この対応は各問題の主題の分類であり、全55項目・全キーワードの網羅を意味しません。従来の未収録領域は今回追加していません。Q6のA*、Q66の中心極限定理、Q67のp値、現代の生成AI運用などは関連する学習目標へ整理しており、全ての用語がシラバスのキーワード欄に逐語的に掲載されているという意味ではありません。実際の本試験と同じ難易度・配点であるとの保証もしません。

## 内容の点検

100問を問題文・4つの選択肢・正解・結論・具体例・3つの誤答理由の組で読み合わせました。自動テストで確認できるのはデータと機能の整合性で、説明の意味が正しいことの証明ではありません。

数値例では、独立事象0.12／和事象0.58、陽性後の有病確率90/1080、z値2、分散36、畳み込み出力3、ノルム5、ε-greedy0.85などを点検しました。勾配消失の例0.1の10乗は100億分の1です。

### 法律問題の確認状況（統合前の未解決事項）

対象はQ79・81・82・83・84・85です。適用条件、例外・留意点、根拠条文・公式URL、編集点検日2026年11月6日を記載しました。

**e-Gov・個人情報保護委員会等の一次資料はネットワーク制限で接続が拒否され、現行本文を直接確認できていません。** 編集点検日を法令原典の確認日と偽らないよう、画面でも「本文未確認」「最終確認が必要」と明示しています。新たな法的助言を保証するものではありません。

根拠として示した条文は以下ですが、現行条文と例外の最終照合は未完了です。この未完了を残してmainへ統合しない方針です。

| 問題 | 根拠・照合対象 |
|---|---|
| 79 | 個人情報保護法第2条、第41条〜第46条（加工情報） |
| 81 | 著作権法第30条の4 |
| 82 | 個人情報保護法第2条第3項、第20条第2項 |
| 83 | 個人情報保護法第27条・第28条 |
| 84 | 民法第632条・第643条・第656条、契約上の利用許諾。個別契約の判断と法定義務を区別 |
| 85 | 不正競争防止法第2条第6項 |

JDLAの学習目標との対応だけでは、法令の現行性や例外を確認したことにはなりません。設定ドラフトには確認用の公的サイトを追加しましたが、ドラフトの保存だけでは実行環境へ適用されません。

## 実在を確認して参照した技術資料

以下はソースコード内の公式ドキュメントや公開教材です。教材の全ての例が出典にそのまま載っているという意味ではありません。具体例は本アプリ用に作成しています。

- [PyTorch：活性化関数](https://github.com/pytorch/pytorch/blob/main/torch/nn/modules/activation.py)
- [PyTorch：Batch Normalization](https://github.com/pytorch/pytorch/blob/main/torch/nn/modules/batchnorm.py)
- [PyTorch：Dropout](https://github.com/pytorch/pytorch/blob/main/torch/nn/modules/dropout.py)
- [scikit-learn：分類指標](https://github.com/scikit-learn/scikit-learn/blob/main/sklearn/metrics/_classification.py)
- [scikit-learn：順位・ROC指標](https://github.com/scikit-learn/scikit-learn/blob/main/sklearn/metrics/_ranking.py)
- [Dive into Deep Learning：確率](https://github.com/d2l-ai/d2l-en/blob/master/chapter_preliminaries/probability.md)
- [Dive into Deep Learning：Q学習](https://github.com/d2l-ai/d2l-en/blob/master/chapter_reinforcement-learning/qlearning.md)
- [Dive into Deep Learning：Attention](https://github.com/d2l-ai/d2l-en/blob/master/chapter_attention-mechanisms-and-transformers/attention-scoring-functions.md)
- [Dive into Deep Learning：GAN](https://github.com/d2l-ai/d2l-en/blob/master/chapter_generative-adversarial-networks/gan.md)

## テスト

作業ブランチを最新mainから作り、全問解説の拡張前には第1段階のテストを実行して成功しました。

```sh
cd /workspace/gkentei-app
node tests/quiz.test.cjs
node tests/browser-smoke.cjs
```

- Node標準ライブラリの7テスト：100問・ID・6部構成・300個の誤答理由、全100問×全24順序＝2,400通りの採点と二重回答防止、旧履歴互換、誤答登録と復習、5問採点・セット数、誤答のラベル、法令確認状況を検査。
- 実ブラウザ：全100問で誤答→採点→復習→正答を操作。全5折りたたみを開き、320/390/1280pxで横にはみ出さないことを検査。法令欄を表示し、キーボードでも展開。履歴再読み込み・分野別成績・弱点優先を確認。
- JavaScriptエラーを収集して0件であることを検査。
- ブラウザテストは同梱PlaywrightとChromiumを使用。Chromiumの場所はCHROMIUM_PATHで指定できます。テスト用HTTPサーバーと隔離ブラウザで利用者のデータを触りません。

### 未実施・保証しない項目

- iPhone実機のSafariでの動作（モバイル幅のChromiumでの検証とは区別）。
- 法律一次資料の現行性・例外の最終照合。
- 実利用者の初回正答率・設問の識別力による難易度校正。
- 既存の改訂前履歴を、問題改訂版ごとに分けて分析する機能。

上記のうち法令の最終照合は正式版への統合前に解決する必要があります。
