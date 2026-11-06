# gkentei-app

G検定対策の学習用Webアプリです。依存パッケージ不要の静的な `index.html` に100問を収録しています。復習コーチの `coach.js` を同じ場所に置いて使います。JDLA公式問題ではなく、本試験と同じ難易度・得点を保証するものではありません。

## 学習機能

- ランダム5問、未回答・誤答を優先する5問、誤答の復習
- パーソナル復習コーチ：履歴に基づく今日のおすすめ5問と選定理由
- 履歴の破損時保護、端末内JSONバックアップ
- 出題時の選択肢シャッフルと即時採点
- 100問すべての6部構成解説（直感的な説明、結論、基礎知識、具体例、3つの誤答理由、重要ポイント）
- モバイルでも読み進めやすい折りたたみ式の解説
- ブラウザ内への履歴保存、分野別成績

保存キー・問題ID・履歴形式は維持しています。ブラウザや端末間の同期はありません。

## ローカル起動

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

## 確認

```sh
node tests/quiz.test.cjs
TZ=Asia/Tokyo node tests/coach.test.cjs
node tests/browser-smoke.cjs
node tests/coach-browser.cjs
```

後者はPlaywrightとChromiumが必要です。クラウド環境には同梱済みで、Chromiumの場所は `CHROMIUM_PATH` で指定できます。

[実装・テスト結果・未確認事項](docs/all-lessons-quality.md)を参照してください。法律6問は2026年11月6日時点の施行法令本文と照合しました。[法令照合記録](docs/legal-review-2026-11-06.md)を参照してください。復習コーチの仕組み・保存互換性・検証範囲は[設計資料](docs/review-coach.md)を参照してください。
