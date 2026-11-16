# AWS Emulator Docker 統合環境

[AWS Emulator 公式ドキュメント](https://docs.aws.amazon.com/emulator/latest/userguide/getting-started-docker.html) に基づき、**AWS Emulator**、**Python (Boto3) 開発環境**、**Frontend Web UI** を Docker Compose で統合したローカル開発環境です。

---

## 構成概要

| サービス | ポート | 役割 |
| :--- | :--- | :--- |
| **aws-emulator** | `9297` | AWS 公式エミュレータ。S3、SQS、DynamoDB などの AWS サービスを完全ローカルで再現 |
| **python** | `8002` (コンテナ内 `8000`) | Python 3.12 実行環境。Boto3 を用いたスクリプト実行 & Frontend 向け FastAPI サーバー |
| **frontend** | `3000` | Vite + React 製の Web UI コンソール。ブラウザから直感的にリソースの閲覧・作成が可能 |

---

## クイックスタート

### 1. 起動

```bash
docker compose up -d --build
```

### 2. アクセス

- **Frontend Web UI**: [http://localhost:3000](http://localhost:3000)
  - ブラウザから S3 バケット、SQS キュー、DynamoDB テーブルの作成・確認が可能です。
- **Python Backend API Docs (Swagger)**: [http://localhost:8002/docs](http://localhost:8002/docs)
- **AWS Emulator エンドポイント**: `https://127.0.0.1:9297`

---

## 使い方・検証

### 1. Python コンテナでテストスクリプトを実行する

Python コンテナ内には、S3・SQS・DynamoDB の動作を一括検証するテストスクリプトを用意しています。

```bash
docker compose exec python python test_emulator.py
```

### 2. Python 対話シェルや Bash に入る

```bash
docker compose exec python bash
```

コンテナ内ではすでに `AWS_ENDPOINT_URL` などの環境変数がセットされており、すぐに `python` から `boto3` を利用できます。

```python
import boto3

s3 = boto3.client('s3', endpoint_url='https://aws-emulator:9297', verify=False)
print(s3.list_buckets())
```

### 3. ホストマシンの AWS CLI から接続する

ホストマシン側のターミナルから直接 AWS Emulator を叩く場合は、以下の環境変数を設定します（エミュレータは `--auth off` で起動しているため、ダミー認証情報でアクセス可能です）:

```bash
export AWS_ENDPOINT_URL=https://127.0.0.1:9297
export AWS_REGION=us-east-1
export AWS_DEFAULT_REGION=us-east-1
export AWS_ACCESS_KEY_ID=emulator
export AWS_SECRET_ACCESS_KEY=emulator
export AWS_EC2_METADATA_DISABLED=true
export AWS_DISABLE_HOST_PREFIX_INJECTION=true

# S3 バケット一覧（自己署名証明書のため --no-verify-ssl を指定）
aws s3 ls --no-verify-ssl

# S3 バケット作成テスト
aws s3 mb s3://my-local-test-bucket --no-verify-ssl
```

---

## SMTP 設定（実メール送信）

次のフォームでは、**送信方法** を選びます。

- Mailbox のテストメール送信
- Pipeline のブロードキャスト配信
- SNS 画面のサブスクリプション作成（確認メール）とメッセージ発行（通知メール）

| 送信方法 | 動作 |
| :--- | :--- |
| 🌐 SMTP で送信 | 設定した SMTP サーバーから実際に送信します。SMTP が未設定（または無効）だと、選んだ時点でフォーム上部にエラーが出て、送信ボタンが押せなくなります |
| 🧪 擬似送信 | 外部には送らず、送信済み（`🧪 擬似送信済`）として **Mailbox** に記録します。SMTP の設定は不要で、設定済みでも外部には送りません |

画面のチェックをすり抜けて SMTP 指定で送られた場合も、未設定ならサーバー側で HTTP 400 として拒否します。その場合、SNS への発行もメール送信も行いません。API では `delivery_mode`（`local` / `smtp`）で指定します。省略すると、SMTP が有効なら SMTP、そうでなければ擬似送信になります（SQS のメールタスク処理はこの動作です）。接続テストは、SMTP 未設定なら擬似送信モードとして成功します。

実際にメールを届けたい場合だけ SMTP を設定します。設定すると、次のメールが実際に送信されます。

- **Mailbox** のテストメール送信
- **Pipeline** のブロードキャスト配信（SNS トピックのメールサブスクライバー宛て）
- SQS のメールタスク処理

SMTP 設定は 1 つだけで、Mailbox と Pipeline の両方で使われます。どちらの画面で変更しても同じ設定が変わります。

### 方法 1: Web UI から設定する（おすすめ）

1. [http://localhost:3000/mailbox](http://localhost:3000/mailbox)、[http://localhost:3000/pipeline](http://localhost:3000/pipeline)、[http://localhost:3000/sns](http://localhost:3000/sns) のいずれかを開く（設定は共通）
2. 「⚙️ SMTP 設定（実メール送信）」カードに、ホスト・ポート・ユーザー名・パスワード・送信元アドレスを入力する
3. 「実メール送信を有効にする」にチェックを入れて **保存** する
4. **接続テスト** を押して、接続と認証が通るか確認する（メールは送られません。SMTP 未設定なら擬似送信モードとして成功します）
5. Mailbox でテストメールを送るか、Pipeline でブロードキャストを実行する。一覧のステータスが `🌐 SMTP送信済` になれば成功です

- 画面で保存した設定はコンテナ内だけに保存され、コンテナを削除すると消えます。毎回同じ SMTP を使う場合は、方法 2 の `.env` に書いてください。
- 画面にはパスワードを表示しません。パスワード欄を空欄のまま保存すると、保存済みのパスワードがそのまま使われます。

### 方法 2: `.env` で初期値を渡す

`.env` に次の値を書いて `docker compose up -d` を実行します。コンテナを作り直しても、この設定は残ります。Web UI で保存した設定があれば、そちらが優先されます。

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASSWORD=xxxxxxxxxxxxxxxx   # Gmail のアプリ パスワード
SMTP_FROM=you@gmail.com
```

### 主なサービスの設定値

| サービス | ホスト | ポート | 認証 |
| :--- | :--- | :--- | :--- |
| Mailpit（ローカル確認用） | `mailpit` | `1025` | 不要 |
| Gmail | `smtp.gmail.com` | `587` | Gmail アドレス + アプリ パスワード（2段階認証が必要） |
| Amazon SES | `email-smtp.<region>.amazonaws.com` | `587` | SES の SMTP 認証情報（送信元アドレスの検証が必要） |
| Microsoft 365 / Outlook | `smtp.office365.com` | `587` | メールアドレス + パスワード（SMTP AUTH の有効化が必要） |
| SendGrid | `smtp.sendgrid.net` | `587` | ユーザー名 `apikey` + API キー |

ポート `465` は SSL で、それ以外は STARTTLS が使えれば STARTTLS で接続します。

### 外部に送らずに確認する（Mailpit）

```bash
docker compose --profile mailpit up -d
```

SMTP 設定をホスト `mailpit`、ポート `1025`、ユーザー名とパスワードは空欄にして保存します。送信したメールは [http://localhost:8025](http://localhost:8025) で確認できます。

### 注意・トラブルシューティング

- SMTP 接続は `python` コンテナから行われます。ホスト PC 上の SMTP サーバーを指すときは `localhost` ではなく `host.docker.internal` を使ってください。
- `535 Authentication failed` は認証エラーです。Gmail は通常のパスワードでは送れないため、アプリ パスワードを使ってください。
- `timed out` / `Connection refused` は、ホスト名やポートの誤り、またはネットワークで 587/465 が塞がれている場合に出ます。
- `wrong version number` は、465（SSL）と 587（STARTTLS）を取り違えたときに出ます。
- SMTP 送信に失敗しても、メールは Mailbox に `❌ SMTP失敗` として記録されます。エラー内容は詳細を開くと確認できます。
- SMTP の設定をやめて擬似送信モードに戻すには、「実メール送信を有効にする」のチェックを外して保存してください。

---

## SNS / SQS（AWS と同じ流れ）

### SNS のメール購読（承認制）

AWS と同じく、メールアドレス（`email` / `email-json`）の購読は **承認待ち** から始まります。

1. AWS コンソールと同じ流れで、**SNS 画面** から登録します
   - **トピックの作成**：タイプ（スタンダード / FIFO）・名前・表示名（オプション）を指定します。FIFO は名前の末尾に `.fifo` が付きます。表示名は、Eメール購読者へのメールの送信者名になります（未設定なら `AWS Notifications`）
   - **サブスクリプションの作成**：トピック ARN（トピックが 1 つだけなら自動で選択）・プロトコル（Eメール）・エンドポイント（メールアドレス）と、確認メールの送信方法（🌐 SMTP / 🧪 擬似送信）を指定します
   - FIFO トピックは、AWS と同じく Eメールの購読に対応していません（選ぶとエラーになります）。FIFO トピックへの発行には、メッセージグループ ID が必要です
   - 登録すると購読が「⏳ 承認待ち」になり、確認メール（件名 `AWS Notification - Subscription Confirmation`）が送られます
   - Pipeline 画面では、購読の状態を表示するだけです。メールアドレスの登録は行いません
2. 確認メール内のリンクを開くと「✅ 承認済み」になります。リンクの有効期限は 3 日です
   - 擬似送信のときは、Mailbox で確認メールを開いてリンクをクリックしてください
   - 期限切れやメールの紛失時は、SNS 画面の購読一覧の「確認メールを再送」（擬似送信 / SMTP を選択）で新しいリンクを発行できます（古いリンクは無効になります）
3. メッセージを発行すると、**承認済みの購読にだけ** メールが届きます。承認待ちの購読には送られません
4. 通知メールの件名は発行時の Subject（空なら `AWS Notification Message`）で、本文の末尾に配信停止リンクが付きます

確認メールと通知メールのリンクは、`PUBLIC_BASE_URL`（既定 `http://localhost:3000`）を元に作ります。別のホスト名やポートで Web UI を開く場合は、`.env` で変更してください。

### SNS → SQS

- SQS キューを紐付けると、キューポリシーに「このトピックからの `sqs:SendMessage` を許可」を **追記** します。既存のポリシーは消しません。同じトピックを 2 回紐付けても、許可は重複しません
- 発行されたメッセージは、SNS が紐付いたキューへ自動で配信します

### SQS のメールタスク処理（コンシューマー）

`POST /api/sqs/queues/{queue}/process-messages` は、AWS で一般的なコンシューマーと同じ流れで処理します。

1. 最大 10 件受信する（キューの可視性タイムアウトのあいだ、そのメッセージは他から見えなくなる）
2. `{"type": "email_task", "to", "subject", "body"}` のメッセージはメールを送り、**成功したものだけ削除** する
3. メールタスク以外、形式が不正なもの、送信に失敗したものは **削除しない**。可視性タイムアウトが過ぎるとキューに戻り、再び受信できる。キューに DLQ（RedrivePolicy）を設定していれば、`maxReceiveCount` 回を超えたところで DLQ に移る
4. SNS 経由で届いたメッセージ（通知 JSON に包まれた形）は、中身を取り出して処理する

---

## DynamoDB（AWS と同じ仕様）

DynamoDB は AWS の DynamoDB と同じ考え方で扱います。

| 項目 | 内容 |
| :--- | :--- |
| テーブル | テーブル名・パーティションキー（必須）・ソートキー（任意）・課金モード（オンデマンド / プロビジョンド）を指定して作成します |
| キー | キー属性の型は S / N / B。キー以外の属性は定義しません |
| インデックス | GSI（任意の属性をキーにする）と LSI（テーブルと同じ PK ＋ 別の SK）。射影は ALL / KEYS_ONLY / INCLUDE。LSI は、テーブルにソートキーがある場合にテーブル作成時だけ作れます |
| アイテム | スキーマレスです。必須なのはキー属性だけで、ほかの属性はアイテムごとに自由です |
| 型 | AWS と同じ 10 種類です。S（文字列）・N（数値）・B（バイナリ）・BOOL・NULL・M（マップ）・L（リスト）・SS / NS / BS（セット） |
| 保存 | PutItem と同じく、同じキーのアイテムがあれば丸ごと置き換えます |
| エラー | DynamoDB が返したエラーを、AWS と同じエラーコードのまま返します（例: `ValidationException: ...`、`ResourceNotFoundException: ...`） |

### 使い方（Web UI）

1. [http://localhost:3000/dynamodb](http://localhost:3000/dynamodb) の「➕ テーブルを作成」で、テーブル名・キー・インデックス・キャパシティを指定する
2. テーブル一覧の「📂 アイテム」から、アイテムを作成・置き換え・削除する
   - 入力行で、属性名・型・値を入力します。キー属性は最初から並んでいます
   - 「DynamoDB JSON で入力する」を開くと、AWS コンソールの JSON ビューと同じ形式で入力できます（B / BS は base64）
   - 各アイテムの「DynamoDB JSON」で、保存されている内容を確認できます

### API でアイテムを保存する例

```bash
curl -X PUT http://localhost:8002/api/dynamodb/item -H 'Content-Type: application/json' -d '{
  "table_name": "Users",
  "item": {
    "id":      {"S": "user-1"},
    "age":     {"N": "30"},
    "tags":    {"SS": ["a", "b"]},
    "profile": {"M": {"city": {"S": "Tokyo"}}}
  }
}'
```

アイテム一覧（Scan）は、ページングしながら最大 1,000 件を返します。

---

## Python API（CRUD 構成と Swagger）

### Swagger / OpenAPI

| 種類 | URL / ファイル |
| :--- | :--- |
| Swagger UI | [http://localhost:8002/docs](http://localhost:8002/docs) |
| ReDoc | [http://localhost:8002/redoc](http://localhost:8002/redoc) |
| OpenAPI（実行中のアプリ） | [http://localhost:8002/openapi.json](http://localhost:8002/openapi.json) |
| OpenAPI（ファイル） | `python/openapi/openapi.json`, `python/openapi/openapi.yaml` |

Swagger UI では、エンドポイントが **Create / Read / Update / Delete** の 4 グループに分かれて表示されます。概要の先頭にある `[S3]` や `[SQS]` は対象サービスです。上部のフィルター欄に `S3` などと入力すると、そのサービスだけに絞り込めます。

エンドポイントを追加・変更したら、OpenAPI ファイルを再生成してください。

```bash
docker compose up -d --build python   # pyyaml を追加したので初回は再ビルド
docker compose exec python python scripts/export_openapi.py
```

### CRUD の分類ルール

ソースは `python/app/routers/<create|read|update|delete>/<サービス>.py` に置いています。URL パスは分割前から変えていないので、フロントエンドの変更は不要です。

| フォルダー | 入れるもの | 例 |
| :--- | :--- | :--- |
| `create/` | 新しいリソース・メッセージ・メールを作る | バケット作成、SQS 送信、SNS 発行、メール送信 |
| `read/` | 状態を変えない処理（POST でも可） | 一覧・取得、DynamoDB Query、SMTP 接続テスト |
| `update/` | 既存リソースや設定を更新する（upsert を含む） | SMTP 設定保存、DynamoDB PutItem |
| `delete/` | 削除する（POST でも可） | バケット削除、購読解除、DynamoDB アイテム削除 |

### エンドポイントの追加手順

1. `app/schemas/<サービス>.py` にリクエストモデルを追加する（`Field(description=..., examples=[...])` を付けると Swagger に表示されます）
2. `app/routers/<crud>/<サービス>.py` に `@router.get/post/...` を追加する（`summary="[サービス] 〇〇"` を付ける）
3. 新しいファイルを作った場合は、`app/routers/<crud>/__init__.py` に `router.include_router(...)` を追加する
4. `scripts/export_openapi.py` を実行して OpenAPI ファイルを更新する

---

## ディレクトリ構成

```
.
├── docker-compose.yml          # 全コンテナのオーケストレーション定義
├── .env                        # アーキテクチャ設定 (aarch64 / x86_64)
├── emulator/
│   └── Dockerfile              # AWS公式ドキュメント準拠の Emulator Dockerfile
├── python/
│   ├── Dockerfile              # Python 3.12 実行環境
│   ├── requirements.txt        # boto3, fastapi, uvicorn, pyyaml 等
│   ├── main.py                 # FastAPI アプリ本体（OpenAPI メタデータ・ルーター登録のみ）
│   ├── test_emulator.py        # CLI 動作検証スクリプト
│   ├── openapi/
│   │   ├── openapi.json        # OpenAPI 定義（Swagger）
│   │   └── openapi.yaml
│   ├── scripts/
│   │   └── export_openapi.py   # 起動中のアプリから openapi.json / yaml を再生成
│   └── app/
│       ├── config.py           # 環境変数定義
│       ├── aws_client.py       # Boto3 クライアントラッパー
│       ├── utils.py
│       ├── routers/            # API エンドポイント（CRUD ごとにフォルダー分割）
│       │   ├── create/         #   作成系  s3 / sqs / sns / mail / pipeline / dynamodb
│       │   ├── read/           #   参照系  system / s3 / sqs / sns / mail / pipeline / smtp / dynamodb
│       │   ├── update/         #   更新系  smtp / dynamodb
│       │   └── delete/         #   削除系  s3 / sqs / sns / mail / pipeline / dynamodb
│       ├── schemas/            # リクエスト / レスポンスの Pydantic モデル（Swagger のスキーマ）
│       └── services/           # ビジネスロジック（mail_service / pipeline / dynamo_service）
├── frontend/
│   ├── Dockerfile              # Node.js 20 開発用コンテナ
│   ├── package.json
│   ├── vite.config.ts          # プロキシ設定 (/api -> python:8000)
│   ├── index.html
│   └── src/
│       ├── App.tsx             # メインダッシュボード画面
│       ├── index.css           # スタイルシート
│       └── components/         # 各サービス操作コンポーネント
└── README.md
```

---

## データの保存について

この環境では、データを**コンテナの中にだけ**保存します。ボリュームやホストのフォルダーには保存しないため、コンテナを削除するとすべて消えます。

| データ | 保存場所（コンテナ内） |
| :--- | :--- |
| S3 / SQS / SNS / DynamoDB のリソースとデータ | `aws-emulator` の `/root/.aws/emulator` |
| 送信メール履歴（Mailbox）・画面で保存した SMTP 設定 | `python` の `/data` |

| 操作 | AWS のリソース（エミュレータ） | メール履歴・SMTP 設定（python） |
| :--- | :--- | :--- |
| `docker compose stop` → `start`、`restart`、PC の再起動 | **消える**（エミュレータはメモリ上に保持し、停止すると全リソースを削除するため） | 残る |
| `docker compose down`、`up --build` などでコンテナを作り直す | **消える** | **消える** |

- `python` コンテナにはソースコード（`./python`）だけをマウントしており、データはホストに書き込みません
- 毎回使う設定（SMTP など）は `.env` に書いてください
- `frontend` の `/app/node_modules` はパッケージ置き場の匿名ボリュームで、データは入りません。不要なボリュームも消すときは `docker compose down -v` を使ってください

---

## 停止

```bash
docker compose down
```
コンテナを削除するので、作成したリソースやメール履歴などのデータもすべて消えます。`node_modules` 用の匿名ボリュームも一緒に消す場合は:
```bash
docker compose down -v
```
