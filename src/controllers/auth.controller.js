import { generateToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';
/**
 * Authentication Controller
 * Handles all authentication-related business logic
 */
class AuthController {
  /**
   * Handle user login
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async login(req, res) {
    const { email, password } = req.body;
    

    logger.info('Login attempt:', { email });

    try {
      // Find user by email
      const user = await User.findByEmail(email);
      
      if (!user) {
        logger.warn('Login failed - user not found:', { email });
        return res.status(400).json({
          success: false,
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Check if user is active
      if (!user.isActive) {
        logger.warn('Login failed - user inactive:', { email });
        return res.status(400).json({
          success: false,
          message: 'Account is deactivated',
          code: 'ACCOUNT_INACTIVE'
        });
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password, config.bcryptRounds);

      if (!isPasswordValid) {
        logger.warn('Login failed - invalid password:', { email });
        return res.status(400).json({
          success: false,
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Update last login
      await user.updateLastLogin();

      // Generate JWT token
      const tokenPayload = {
        id: user._id,
        email: user.email,
        role: user.role,
        school_id: user.school_id
      };

      const token = generateToken(tokenPayload);

      logger.info('Login successful:', { 
        email, 
        role: user.role, 
        school_id: user.school_id 
      });

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user._id,
            email: user.email,
            role: user.role,
            school_id: user.school_id
          }
        }
      });
    } catch (error) {
      logger.error('Login error:', { email, error: error.message });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'SERVER_ERROR'
      });
    }
  }
  async register(req,res){
        const { email, password, role, school_id } = req.body;
        
        logger.info('Registration attempt:', { email });
        try {
            
            // Check if user already exists
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                logger.warn('Registration failed - user already exists:', { email });
                return res.status(400).json({
                    success: false,
                    message: 'User with this email already exists',
                    code: 'USER_EXISTS'
                });
            }
            // Create new user
            const newUser = new User({
                email,
                password: password,
                role,
                school_id,
                isActive: true
            });
            await newUser.save();
            logger.info('Registration successful:', { email });
            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                data: {
                    id: newUser._id,
                    email: newUser.email,
                    role: newUser.role,
                    school_id: newUser.school_id
                }
            });
        } catch (error) {
            logger.error('Registration error:', { email, error: error.message });
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                code: 'SERVER_ERROR'
            });
        }
            
    }

  /**
   * Handle user logout (if needed for token blacklisting)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async logout(req, res) {
    // This is a placeholder for logout functionality
    // Can be extended to handle token blacklisting if needed
    logger.info('User logged out:', { userId: req.user?.id });
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }

  /**
   * Get current user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            role: user.role,
            school_id: user.school_id,
            isActive: user.isActive,
            lastLogin: user.lastLogin,
            createdAt: user.createdAt
          }
        }
      });
    } catch (error) {
      logger.error('Get profile error:', { userId: req.user.id, error: error.message });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'SERVER_ERROR'
      });
    }
  }
}

export default new AuthController();
