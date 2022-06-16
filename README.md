# Crypto Quest server

## Environment Setup

1. Install Rust from https://rustup.rs/
2. Install Solana CLI from https://docs.solana.com/cli/install-solana-cli-tools#use-solanas-install-tool
3. Install Spl-Token CLI from https://spl.solana.com/token
4. Install Anchor from https://project-serum.github.io/anchor/getting-started/installation.html
5. Install Postgres from https://www.postgresql.org/download/
6. Install Redis-server from https://redis.io/docs/getting-started/
7. Install Blender v3.1 from https://www.blender.org/download/releases/3-1/

## Backend server setup

### Prepare folders structure

```shell
$ mkdir CRYPTOQUESTNFT-SERVER
$ cd CRYPTOQUESTNFT-SERVER
$ mkdir metadata
$ mkdir blender_output
$ git clone https://github.com/anth226/cryptoquest-server.git server
```

### Update authtority keypair

Create 'keypair.json' file inside 'CRYPTOQUESTNFT-SERVER' folder. Paste inside 'keypair.json' secret key as Uint8Array format.

### Install dependencies for express server

```shell
$ cd server
$ npm install
```

### Update .env

1. Set LOCAL_ADDRESS for local ip address
2. Set UPDATE_AUTHORITY_DEVELOPMENT for PublicKey of update authtority for development collection
3. Set PINATA_API_KEY_DEVELOPMENT, PINATA_API_SECRET_KEY_DEVELOPMENT, PINATA_JWT_DEVELOPMENT, PINATA_GATEWAY_DEVELOPMENT for development Pinata account
4. Set BLENDER_OUTPUT_LOCAL_ADDRESS for for full path to 'blender_output' folder

## Database setup

1. Create database 'cryptoquest' with user 'postgres'

```shell
$ sudo -i -u postgres
$ psql
$ CREATE DATABASE cryptoquest;
$ \c cryptoquest
```

2. Change password for user postgres for new password from 'DB_PASSWORD' variable inside '/app/.env' file

```shell
$ ALTER USER postgres PASSWORD 'newpassword';
```

3. Execute all commands from './app/config/database.sql' file inside Postgres PSQL tool to create database and all tables

4. Add user for admin panel

```shell
$ INSERT INTO users (username, password) VALUES('admin', '$2a$08$HPXZtusLkfjdq6YbkyiDl.Kz9yi9izK.9FEXCzJ8.eXkn9UUIsjE2');
```

5. Fill out tables with tokens data

Woodland Respite Google Sheets - https://docs.google.com/spreadsheets/d/10-1C7PpMtKb8PZApgfGWHALCHjIPNPC6-Hrbo11zcUQ/edit?usp=sharing
Woodland Respite CSV - https://drive.google.com/file/d/1GB42BaKBtRb7B2_CR6UnmkmdjWVXBBB-/view?usp=sharing

Dawn of Man Google Sheets - https://docs.google.com/spreadsheets/d/1AN9TjHjJVLSnFaxjvZkPJC374k6HheXi4TlErD-_IsM/edit?usp=sharing
Dawn of Man CSV - https://drive.google.com/file/d/1gBrHVGl84Ig4MwrchyECO1QDoehg_Qs8/view?usp=sharing

Download csv files with data for tomes and copy them into '/tmp' folder on computer

Fill out tables with data from csv files

```shell
$ COPY woodland_respite(token_number, cosmetic_points, stat_points, ht_points_cp, ht_points_sp, ht_points_total, hero_tier, legacy) FROM '/tmp/Woodland_Respite_1250_Legacy.csv' DELIMITER ',' CSV HEADER;
$ COPY dawn_of_man(token_number, cosmetic_points, stat_points, ht_points_cp, ht_points_sp, ht_points_total, hero_tier, legacy) FROM '/tmp/Dawn_of_Man_1250_Legacy.csv' DELIMITER ',' CSV HEADER;
```

## Blender setup

1. Download Addon from https://drive.google.com/file/d/1BevZnrYjDIjIrwNyPAPixWLwWFvgYlfE/view?usp=sharing
   Reserved copy of Addon stored on VPS server (/home/zhopkins/Blender/Blender3/3.1/scripts/addons/CryptoQuest.zip)
2. Unzip Addon inside 'blender/3.1/scripts/addons/' with folder name 'CryptoQuest'

## Run backend server

```shell
// Run redis server inside separate terminal tab
$ redis-server
// Check is redis server working, should get ouput 'PONG'
$ redis-cli ping

$ npm run start:dev
```
