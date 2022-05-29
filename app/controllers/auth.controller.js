const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const pool = require('../config/db.config');

// Generate nonce for wallet signature on website
exports.generateNonce = async (req, res) => {
  try {
    const nonce = crypto.randomBytes(32).toString('base64');

    res.status(200).send({ nonce });
  } catch (error) {
    console.error(error.message);
    res.status(405).send(error.message);
  }
};

// Send user data for login and sign in on Admin UI
const sendUserData = async (user, res) => {
  const token = jwt.sign({ id: user.id }, process.env.TOKEN_SECRET, {
    expiresIn: 86400, // JWT token expires after 1 day
  });

  res.status(200).send({
    username: user.username,
    userId: user.id,
    jwt: token,
  });
};

// Sign in to Admin UI
exports.signIn = async (req, res) => {
  try {
    const { username, password } = req.body;

    const userData = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    const user = userData.rows[0];

    if (!user) {
      return res.status(404).send({ message: `User "${username}" not found` });
    }

    const passwordIsValid = bcrypt.compareSync(password, user.password);

    if (!passwordIsValid) {
      return res.status(401).send({
        message: 'Invalid password',
      });
    }

    sendUserData(user, res);
  } catch (error) {
    res.status(401).send({ message: error.message });
  }
};

// Login to Admin UI using JWT token
exports.login = async (req, res) => {
  try {
    const userData = await pool.query('SELECT * FROM users WHERE id = $1', [
      req.userId,
    ]);
    const user = userData.rows[0];

    if (!user) {
      return res.status(404).send({ message: `User not found` });
    }

    sendUserData(user, res);
  } catch (error) {
    res.status(401).send({ message: error.message });
  }
};

// Sign up to Admin UI (route commented out)
exports.signUp = async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);

    await pool.query('INSERT INTO users (username, password) VALUES($1, $2)', [
      username,
      hashedPassword,
    ]);
    res.status(200).send({ message: 'Success' });
  } catch (error) {
    res.status(401).send({ message: error.message });
  }
};
