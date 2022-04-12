CREATE DATABASE cryptoquest;

CREATE TABLE tokens(
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(100) NOT NULL,
  collection VARCHAR(100) NOT NULL,
  stat_points INT NOT NULL,
  rarity_points INT NOT NULL
);

CREATE TABLE characters(
  id SERIAL PRIMARY KEY,
  nft_id INT,
  token_id VARCHAR(100) NOT NULL,
  constitution INT NOT NULL,
  strength INT NOT NULL,
  dexterity INT NOT NULL,
  wisdom INT NOT NULL,
  intelligence INT NOT NULL,
  charisma INT NOT NULL,
  token_name VARCHAR(255) NOT NULL,
  race VARCHAR(100) NOT NULL,
  sex VARCHAR(100) NOT NULL,
  face_style VARCHAR(100) NOT NULL,
  eye_detail VARCHAR(100),
  eyes VARCHAR(100) NOT NULL,
  facial_hair VARCHAR(100),
  glasses VARCHAR(100),
  hair_style VARCHAR(100) NOT NULL,
  hair_color VARCHAR(100) NOT NULL,
  necklace VARCHAR(100),
  earring VARCHAR(100),
  nose_piercing VARCHAR(100),
  scar VARCHAR(100),
  tattoo VARCHAR(100),
  background VARCHAR(100) NOT NULL,
  CONSTRAINT fk_token FOREIGN KEY(nft_id) REFERENCES tokens(id)
);