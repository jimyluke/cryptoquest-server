-- Create database for all "CryptoQuest" tables
CREATE DATABASE cryptoquest;

-- Create function for trigger update timestamp
CREATE FUNCTION trigger_set_timestamp() RETURNS TRIGGER AS $ $ BEGIN NEW.updated_at = NOW();

RETURN NEW;

END;

$ $ LANGUAGE plpgsql;

-- All NFT tokens after revealing
CREATE TABLE tokens(
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(255) NOT NULL UNIQUE,
  mint_name VARCHAR(255) NOT NULL,
  tome VARCHAR(100) NOT NULL,
  mint_number INT NOT NULL,
  token_number INT NOT NULL,
  stat_points INT NOT NULL,
  cosmetic_points INT NOT NULL,
  stat_tier VARCHAR(100) NOT NULL,
  cosmetic_tier VARCHAR(100) NOT NULL,
  hero_tier VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create trigger "updated_at" for "tokens" table
CREATE TRIGGER set_timestamp BEFORE
UPDATE
  ON tokens FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- NFT characters data after customization
CREATE TABLE characters(
  id SERIAL PRIMARY KEY,
  nft_id INT NOT NULL,
  token_id VARCHAR(100) NOT NULL,
  constitution INT NOT NULL,
  strength INT NOT NULL,
  dexterity INT NOT NULL,
  wisdom INT NOT NULL,
  intelligence INT NOT NULL,
  charisma INT NOT NULL,
  race VARCHAR(100) NOT NULL,
  sex VARCHAR(100) NOT NULL,
  face_style VARCHAR(100) NOT NULL,
  eye_detail VARCHAR(100) NOT NULL,
  eyes VARCHAR(100) NOT NULL,
  facial_hair VARCHAR(100) NOT NULL,
  glasses VARCHAR(100) NOT NULL,
  hair_style VARCHAR(100) NOT NULL,
  hair_color VARCHAR(100) NOT NULL,
  necklace VARCHAR(100) NOT NULL,
  earring VARCHAR(100) NOT NULL,
  nose_piercing VARCHAR(100) NOT NULL,
  scar VARCHAR(100) NOT NULL,
  tattoo VARCHAR(100) NOT NULL,
  background VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_token FOREIGN KEY(nft_id) REFERENCES tokens(id)
);

-- Create trigger "updated_at" for "characters" table
CREATE TRIGGER set_timestamp BEFORE
UPDATE
  ON characters FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- All NFT token names
CREATE TABLE token_names(
  id SERIAL PRIMARY KEY,
  nft_id INT NOT NULL,
  token_name VARCHAR(100) NOT NULL,
  token_name_status VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_token FOREIGN KEY(nft_id) REFERENCES tokens(id)
);

-- Create trigger "updated_at" for "token_names" table
CREATE TRIGGER set_timestamp BEFORE
UPDATE
  ON token_names FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- Shuffled tokens from "Woodland Respite" tome
CREATE TABLE woodland_respite(
  token_number INT PRIMARY KEY NOT NULL,
  cosmetic_points INT NOT NULL,
  stat_points INT NOT NULL,
  ht_points_cp NUMERIC(7, 3) NOT NULL,
  ht_points_sp NUMERIC(7, 3) NOT NULL,
  ht_points_total NUMERIC(7, 3) NOT NULL,
  hero_tier VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create trigger "updated_at" for "woodland_respite" table
CREATE TRIGGER set_timestamp BEFORE
UPDATE
  ON woodland_respite FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- Shuffled tokens from "Dawn of Man" tome
CREATE TABLE dawn_of_man(
  token_number INT PRIMARY KEY NOT NULL,
  cosmetic_points INT NOT NULL,
  stat_points INT NOT NULL,
  ht_points_cp NUMERIC(7, 3) NOT NULL,
  ht_points_sp NUMERIC(7, 3) NOT NULL,
  ht_points_total NUMERIC(7, 3) NOT NULL,
  hero_tier VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create trigger "updated_at" for "dawn_of_man" table
CREATE TRIGGER set_timestamp BEFORE
UPDATE
  ON dawn_of_man FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- Users with access to Admin UI for approving token names
CREATE TABLE users(
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create trigger "updated_at" for "users" table
CREATE TRIGGER set_timestamp BEFORE
UPDATE
  ON users FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- Links to the metadata for nfts
CREATE TABLE metadata(
  id SERIAL PRIMARY KEY,
  nft_id INT NOT NULL,
  stage VARCHAR(255) NOT NULL,
  metadata_url VARCHAR(255) NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_token FOREIGN KEY(nft_id) REFERENCES tokens(id)
);

-- Create trigger "updated_at" for "metadata" table
CREATE TRIGGER set_timestamp BEFORE
UPDATE
  ON metadata FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();