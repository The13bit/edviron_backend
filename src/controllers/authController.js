import User from '../models/User.js';
import authService from '../services/authService.js';
import logger from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/asyncHelpers.js';

class AuthController {
  /**
   * Register a new user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  register = catchAsync(async (req, res) => {
    const { username, email, password, role, trustee_id, school_id } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      throw new AppError('Username, email, and password are required', 400);
    }

    // Validate role-specific fields
    if ((role === 'trustee' || role === 'staff') && (!trustee_id || !school_id)) {
      throw new AppError('Trustee ID and School ID are required for trustee and staff roles', 400);
    }

    logger.info('User registration attempt', {
      username,
      email,
      role: role || 'user'
    });

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username';
      throw new AppError(`User with this ${field} already exists`, 409);
    }

    // Create new user
    const userData = {
      username,
      email,
      password,
      role: role || 'user'
    };

    // Add role-specific fields
    if (role === 'trustee' || role === 'staff') {
      userData.trustee_id = trustee_id;
      userData.school_id = school_id;
    }

    const newUser = await User.create(userData);

    logger.info('User registered successfully', {
      userId: newUser._id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role
    });

    // Create and send token
    authService.createSendToken(newUser, 201, res);
  });

  /**
   * Login user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  login = catchAsync(async (req, res) => {
    const { email, password } = req.body;

    // Check if email and password exist
    if (!email || !password) {
      throw new AppError('Please provide email and password', 400);
    }

    logger.info('User login attempt', { email });

    // Check if user exists and password is correct
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.correctPassword(password, user.password))) {
      logger.warn('Failed login attempt', {
        email,
        reason: !user ? 'user_not_found' : 'incorrect_password'
      });
      throw new AppError('Incorrect email or password', 401);
    }

    // Check if user is active
    if (!user.isActive) {
      logger.warn('Login attempt by inactive user', {
        userId: user._id,
        email
      });
      throw new AppError('Your account has been deactivated. Please contact support', 401);
    }

    // Update last login
    await user.updateLastLogin();

    logger.info('User logged in successfully', {
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    });

    // Create and send token
    authService.createSendToken(user, 200, res);
  });

  /**
   * Logout user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  logout = catchAsync(async (req, res) => {
    // Clear JWT cookie
    res.cookie('jwt', 'loggedout', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    });

    logger.info('User logged out', {
      userId: req.user?._id,
      username: req.user?.username
    });

    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully'
    });
  });

  /**
   * Get current user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getMe = catchAsync(async (req, res) => {
    const user = await User.findById(req.user._id);

    logger.debug('Current user retrieved', {
      userId: user._id,
      username: user.username
    });

    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  });

  /**
   * Update current user data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  updateMe = catchAsync(async (req, res) => {
    // Create error if user POSTs password data
    if (req.body.password || req.body.passwordConfirm) {
      throw new AppError('This route is not for password updates. Please use /updatePassword', 400);
    }

    // Filter out unwanted fields that are not allowed to be updated
    const allowedFields = ['username', 'email'];
    const filteredBody = {};
    
    Object.keys(req.body).forEach(el => {
      if (allowedFields.includes(el)) filteredBody[el] = req.body[el];
    });

    // Update user document
    const updatedUser = await User.findByIdAndUpdate(req.user._id, filteredBody, {
      new: true,
      runValidators: true
    });

    logger.info('User profile updated', {
      userId: updatedUser._id,
      updatedFields: Object.keys(filteredBody)
    });

    res.status(200).json({
      status: 'success',
      message: 'User updated successfully',
      data: {
        user: updatedUser
      }
    });
  });

  /**
   * Update current user password
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  updatePassword = catchAsync(async (req, res) => {
    const { passwordCurrent, password, passwordConfirm } = req.body;

    if (!passwordCurrent || !password || !passwordConfirm) {
      throw new AppError('Please provide current password, new password, and password confirmation', 400);
    }

    if (password !== passwordConfirm) {
      throw new AppError('Password and password confirmation do not match', 400);
    }

    // Get user from collection
    const user = await User.findById(req.user._id).select('+password');

    // Check if current password is correct
    if (!(await user.correctPassword(passwordCurrent, user.password))) {
      throw new AppError('Your current password is wrong', 401);
    }

    // Update password
    user.password = password;
    await user.save();

    logger.info('User password updated', {
      userId: user._id,
      username: user.username
    });

    // Log user in, send JWT
    authService.createSendToken(user, 200, res);
  });

  /**
   * Delete current user account
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  deleteMe = catchAsync(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { isActive: false });

    logger.info('User account deactivated', {
      userId: req.user._id,
      username: req.user.username
    });

    res.status(204).json({
      status: 'success',
      data: null
    });
  });

  /**
   * Get all users (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getAllUsers = catchAsync(async (req, res) => {
    const users = await User.find({ isActive: true });

    logger.info('All users retrieved', {
      count: users.length,
      requestedBy: req.user._id
    });

    res.status(200).json({
      status: 'success',
      results: users.length,
      data: {
        users
      }
    });
  });

  /**
   * Get user by ID (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getUser = catchAsync(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (!user) {
      throw new AppError('No user found with that ID', 404);
    }

    logger.info('User retrieved by admin', {
      userId: user._id,
      requestedBy: req.user._id
    });

    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  });

  /**
   * Authentication service health check
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  healthCheck = catchAsync(async (req, res) => {
    const authServiceStatus = authService.getConfigStatus();
    const isHealthy = authServiceStatus.isValid;

    logger.debug('Auth service health check', {
      authService: authServiceStatus,
      healthy: isHealthy
    });

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'success' : 'error',
      message: isHealthy ? 'Authentication service is healthy' : 'Authentication service has configuration issues',
      data: {
        auth_service: authServiceStatus,
        overall_health: isHealthy
      }
    });
  });
}

export default new AuthController();