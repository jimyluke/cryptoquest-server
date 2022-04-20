CREATE DATABASE cryptoquest;

CREATE TABLE tokens(
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(100) NOT NULL,
  collection VARCHAR(100) NOT NULL,
  token_number INT NOT NULL,
  stat_points INT NOT NULL,
  cosmetic_points INT NOT NULL,
  stat_tier VARCHAR(50) NOT NULL,
  cosmetic_tier VARCHAR(50) NOT NULL,
  hero_tier VARCHAR(50) NOT NULL
);

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
  CONSTRAINT fk_token FOREIGN KEY(nft_id) REFERENCES tokens(id)
);

CREATE TABLE woodland_respite(
  id SERIAL PRIMARY KEY,
  token_number INT NOT NULL,
  cosmetic_points INT NOT NULL,
  stat_points INT NOT NULL,
  ht_points_cp NUMERIC(7, 3) NOT NULL,
  ht_points_sp NUMERIC(7, 3) NOT NULL,
  ht_points_total NUMERIC(7, 3) NOT NULL,
  hero_tier VARCHAR(50) NOT NULL
);

CREATE TABLE dawn_of_man(
  id SERIAL PRIMARY KEY,
  token_number INT NOT NULL,
  cosmetic_points INT NOT NULL,
  stat_points INT NOT NULL,
  ht_points_cp NUMERIC(7, 3) NOT NULL,
  ht_points_sp NUMERIC(7, 3) NOT NULL,
  ht_points_total NUMERIC(7, 3) NOT NULL,
  hero_tier VARCHAR(50) NOT NULL
);

CREATE TABLE token_names(
  id SERIAL PRIMARY KEY,
  nft_id INT NOT NULL,
  token_name VARCHAR(100) NOT NULL,
  token_name_status VARCHAR(100) NOT NULL,
  CONSTRAINT fk_token FOREIGN KEY(nft_id) REFERENCES tokens(id)
);

CREATE TABLE users(
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL
);