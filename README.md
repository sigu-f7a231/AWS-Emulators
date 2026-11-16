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

Mailbox のテストメール送信と Pipeline のブロードキャスト配信では、フォームで **送信方法** を選びます。

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

1. [http://localhost:3000/mailbox](http://localhost:3000/mailbox) または [http://localhost:3000/pipeline](http://localhost:3000/pipeline) を開く
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

## DynamoDB の DB / テーブル設計

DynamoDB には本来「データベース」「カラム定義」「外部キー」がありません。この環境では Web UI と API で、それらを使ってテーブルを設計できるようにしています。

| 項目 | 実現方法 |
| :--- | :--- |
| DB | テーブル名の接頭辞で表します。DB「shop」のテーブル「users」は、実テーブル名 `shop.users` で作成されます |
| カラム | 名前・型（S / N / B / BOOL / L / M）・必須・説明を定義します。定義にない属性もアイテムに自由に追加できます |
| 主キー | パーティションキー（必須）とソートキー（任意）を、S / N / B 型のカラムから選びます |
| インデックス | GSI（任意のカラムをキーにできる）と LSI（テーブルと同じ PK で別の SK。テーブルに SK が必要）を作れます |
| 外部キー | 同じ DB 内のテーブル（自分自身も可）の主キーを参照します。参照先が PK+SK なら、カラムも 2 つ指定します |

テーブルは必ず DB の中に作ります。DB に属さないテーブルは作成できず、そうしたテーブルへのアイテム保存も拒否されます。定義はコンテナ内に保存され、エミュレータのデータと同じく、コンテナを削除すると消えます。

### 使い方（Web UI）

1. [http://localhost:3000/dynamodb](http://localhost:3000/dynamodb) の「🗂️ データベース」で DB を作る
2. DB の詳細画面の「➕ テーブルを作成」で、カラム → 主キー → インデックス → 外部キーの順に設定して作成する
   - 外部キーを張るときは、参照される側のテーブル（例: `users`）を先に作ってください
3. 「📐 テーブル定義」で、カラム・キー・インデックスと外部キーの参照先を確認できます。「🔗 リレーション」には紐づきの一覧が出ます
4. 「📂 アイテム管理」でアイテムを登録する。定義したカラムがあらかじめ入力欄に並びます

### アイテム保存時のチェック

設計機能で作ったテーブルにアイテムを保存すると、次の点をチェックします。違反があれば保存されず、HTTP 400 とエラー内容が返ります。

- 型が定義と一致しているか（必須でないカラムは NULL も可）
- 必須カラムが入っているか（主キーは常に必須）
- 外部キーの値がすべて入っている場合、参照先テーブルに同じキーのアイテムがあるか（値が空なら確認しません）

### 削除時のルール

- 他のテーブルから外部キーで参照されているテーブルは削除できません。先に、参照元の外部キーかテーブルを削除してください
- DB は、空の場合のみ削除できます。「テーブルもすべて削除する」にチェックを入れると、中身ごと削除します
- 参照されているアイテムの削除は制限していません（RDB の RESTRICT のような動作はしません）

### 注意

- 主キーとインデックスは、DynamoDB の制約でテーブル作成後に変更できません。説明・カラム・外部キーは `PUT /api/dynamodb/databases/{db}/tables/{table}` で変更できます
- エミュレータのコンテナだけを作り直した場合は、定義が残って実テーブルが消えます。その場合、定義画面に「⚠️ 実テーブルがありません」と表示されます
- API の詳細は Swagger の `[DynamoDB 設計]` を参照してください

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
| 送信メール履歴（Mailbox）・画面で保存した SMTP 設定・DynamoDB の DB/テーブル定義 | `python` の `/data` |

| 操作 | データ |
| :--- | :--- |
| `docker compose stop` → `start`、PC の再起動、`restart` | 残る（同じコンテナを使うため） |
| `docker compose down`、`up --build` や設定変更によるコンテナの作り直し | **消える** |

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
