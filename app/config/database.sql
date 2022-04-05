CREATE DATABASE cryptoquest;

CREATE TABLE nfts(
  id SERIAL PRIMARY KEY,
  nft_address VARCHAR(255) NOT NULL,
  collection VARCHAR(255) NOT NULL,
  stat_points INT NOT NULL,
  rarity_points INT NOT NULL
);

CREATE TABLE characters(
  id SERIAL PRIMARY KEY,
  nft_id INT,
  nft_name VARCHAR(255) NOT NULL,
  race VARCHAR(255) NOT NULL,
  sex VARCHAR(255) NOT NULL,
  face_style VARCHAR(255) NOT NULL,
  eye_detail VARCHAR(255),
  eyes VARCHAR(255) NOT NULL,
  facial_hair VARCHAR(255),
  glasses VARCHAR(255),
  hair_style VARCHAR(255) NOT NULL,
  hair_color VARCHAR(255) NOT NULL,
  necklace VARCHAR(255),
  earring VARCHAR(255),
  nose_piercing VARCHAR(255),
  scar VARCHAR(255),
  tattoo VARCHAR(255),
  background VARCHAR(255) NOT NULL,
  CONSTRAINT fk_nft FOREIGN KEY(nft_id) REFERENCES nfts(id)
);