const { AppDataSource } = require("../data-source");
const User = require("../entity/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userRepository = AppDataSource.getRepository(User);

class AuthController {
  static async register(req, res) {
    const { username, password, email, fullName, role } = req.body;

    // Validation
    if (!username || !password || !email) {
      return res
        .status(400)
        .json({ message: "Username, password, and email are required" });
    }

    try {
      // Check if user exists
      const existingUser = await userRepository.findOne({
        where: [{ username }, { email }],
      });
      if (existingUser) {
        return res
          .status(409)
          .json({ message: "Username or email already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = userRepository.create({
        username,
        password: hashedPassword,
        email,
        fullName,
        role: role || "parent", // Default role
      });

      await userRepository.save(user);

      res.status(201).json({ message: "User created successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error registering user" });
    }
  }

  static async login(req, res) {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password are required" });
    }

    try {
      const user = await userRepository.findOneOrFail({ where: { username } });

      // Check password
      if (!(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Generate JWT
      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET || "your_jwt_secret_key", // TODO: Move to .env
        { expiresIn: "1h" },
      );

      res.json({
        token,
        user: { id: user.id, username: user.username, role: user.role },
      });
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: "Invalid credentials" });
    }
  }
}

module.exports = AuthController;
