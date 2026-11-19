import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import dns from 'dns';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import ProviderProfile from '../models/providerProfile.js';
import Booking from '../models/booking.js';

dotenv.config();

// Configure Google Public DNS for MongoDB Atlas SRV record resolution
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  console.log('DNS setServers notice:', e.message);
}

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in the environment');
}

// Middleware
app.use(express.json());
app.use(cors());

// Token Authentication Middleware

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const authenticateAdmin = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
    }
    next();
  });
};


// Database connection
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart_local_service_finder';

const seedDefaultAdmin = async () => {
  try {
    const adminEmail = 'admin@slsf.com';
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const admin = new User({
        fullName: 'System Administrator',
        email: adminEmail,
        phone: '01700000000',
        password: hashedPassword,
        role: 'admin',
      });
      await admin.save();
      console.log('👑 Default Admin created: admin@slsf.com / admin123');
    }
  } catch (err) {
    console.error('Error seeding default admin:', err.message);
  }
};

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log(`✅ MongoDB connected successfully to ${MONGO_URI.includes('mongodb+srv') ? 'MongoDB Atlas Cloud' : 'Local MongoDB'}`);
    seedDefaultAdmin();
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    if (err.message.includes('IP that isn\'t whitelisted') || err.name === 'MongooseServerSelectionError') {
      console.error('👉 Please make sure your IP is whitelisted on MongoDB Atlas (Network Access -> Add IP Address -> 0.0.0.0/0)');
    }
  });

const attachReviewSummaries = async (profiles) => {
  if (profiles.length === 0) return [];

  const providerIds = profiles.map((profile) => profile.user?._id || profile.user);
  const bookings = await Booking.find({
    provider: { $in: providerIds },
    'review.rating': { $exists: true },
  })
    .sort({ 'review.createdAt': -1 })
    .select('provider customerName serviceTitle review')
    .lean();

  const summaries = new Map();
  for (const booking of bookings) {
    const providerId = String(booking.provider);
    const summary = summaries.get(providerId) || { total: 0, count: 0, reviews: [] };
    summary.total += booking.review.rating;
    summary.count += 1;
    if (summary.reviews.length < 3) {
      summary.reviews.push({
        customerName: booking.customerName,
        serviceTitle: booking.serviceTitle,
        ...booking.review,
      });
    }
    summaries.set(providerId, summary);
  }

  return profiles.map((profile) => {
    const summary = summaries.get(String(profile.user?._id || profile.user));
    return {
      ...profile.toObject(),
      rating: summary ? Math.round((summary.total / summary.count) * 10) / 10 : 0,
      reviewCount: summary?.count || 0,
      reviews: summary?.reviews || [],
    };
  });
};

// Routes
// 1. User Register Route
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, phone, password, role } = req.body;

    // Validation: missing required fields
    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ message: 'All fields (full name, email, phone, password) are required' });
    }

    const cleanFullName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    // Validation: email format
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    // Validation: password length
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Validation: check if email or phone already exists
    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { phone: cleanPhone }],
    });

    if (existingUser) {
      if (existingUser.email === cleanEmail) {
        return res.status(400).json({ message: 'An account already exists with this email' });
      }
      if (existingUser.phone === cleanPhone) {
        return res.status(400).json({ message: 'An account already exists with this phone number' });
      }
    }

    // Hash password with bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = new User({
      fullName: cleanFullName,
      email: cleanEmail,
      phone: cleanPhone,
      password: hashedPassword,
      role: role === 'provider' ? 'provider' : 'customer',
    });

    await newUser.save();

    // If registered as provider, initialize Provider Profile
    if (newUser.role === 'provider') {
      const defaultProfile = new ProviderProfile({
        user: newUser._id,
        serviceCategory: 'General Service',
        bio: 'Professional service provider ready to assist with local tasks.',
        hourlyRate: 500,
        location: 'Dhaka, Bangladesh',
        experienceYears: 2,
        isAvailable: true,
      });
      await defaultProfile.save();
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: newUser._id, role: newUser.role, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: newUser,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email or phone number is already registered' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
});

// 2. User Login Route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;

    if (!emailOrPhone || !password) {
      return res.status(400).json({ message: 'Email/Phone and Password are required' });
    }

    const cleanInput = emailOrPhone.trim();

    // Find user by email (lowercase) or phone number
    const user = await User.findOne({
      $or: [{ email: cleanInput.toLowerCase() }, { phone: cleanInput }],
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials. User not found.' });
    }

    // Check password match with bcrypt
    let isMatch = await bcrypt.compare(password, user.password);

    // Legacy fallback for plain-text passwords created before bcrypt hashing was implemented
    if (!isMatch && user.password === password) {
      isMatch = true;
      user.password = await bcrypt.hash(password, 10);
      await user.save();
    }

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials. Incorrect password.' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: 'Your account has been suspended by the administrator.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: user,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login', error: error.message });
  }
});

// 3. User Profile Verification Route (/api/auth/me)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ user });
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token', error: error.message });
  }
});

// ----------------------------------------------------
// PROVIDER DASHBOARD API ROUTES
// ----------------------------------------------------

// 4. Get Provider Profile Details
app.get('/api/provider/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let profile = await ProviderProfile.findOne({ user: req.user.id });
    if (!profile) {
      profile = new ProviderProfile({
        user: req.user.id,
        serviceCategory: 'General Maintenance',
        bio: 'Professional service provider dedicated to quality work.',
        hourlyRate: 500,
        location: 'Dhaka, Bangladesh',
        experienceYears: 2,
        isAvailable: true,
      });
      await profile.save();
    }

    const [profileWithReviews] = await attachReviewSummaries([profile]);
    res.status(200).json({ user, profile: profileWithReviews });
  } catch (error) {
    console.error('Error fetching provider profile:', error);
    res.status(500).json({ message: 'Server error fetching provider profile', error: error.message });
  }
});

// 5. Update Provider Profile & Availability
app.put('/api/provider/profile', authenticateToken, async (req, res) => {
  try {
    const { serviceCategory, bio, hourlyRate, location, experienceYears, isAvailable, fullName, phone } = req.body;

    if (fullName || phone) {
      await User.findByIdAndUpdate(req.user.id, {
        ...(fullName && { fullName: fullName.trim() }),
        ...(phone && { phone: phone.trim() }),
      });
    }

    let profile = await ProviderProfile.findOne({ user: req.user.id });
    if (!profile) {
      profile = new ProviderProfile({ user: req.user.id });
    }

    if (serviceCategory !== undefined) profile.serviceCategory = serviceCategory;
    if (bio !== undefined) profile.bio = bio;
    if (hourlyRate !== undefined) profile.hourlyRate = Number(hourlyRate);
    if (location !== undefined) profile.location = location;
    if (experienceYears !== undefined) profile.experienceYears = Number(experienceYears);
    if (isAvailable !== undefined) profile.isAvailable = Boolean(isAvailable);

    await profile.save();

    const updatedUser = await User.findById(req.user.id);
    const [profileWithReviews] = await attachReviewSummaries([profile]);
    res.status(200).json({ message: 'Profile updated successfully', user: updatedUser, profile: profileWithReviews });
  } catch (error) {
    console.error('Error updating provider profile:', error);
    res.status(500).json({ message: 'Server error updating provider profile', error: error.message });
  }
});

// 6. Get All Bookings for Logged-In Provider
app.get('/api/provider/bookings', authenticateToken, async (req, res) => {
  try {
    let bookings = await Booking.find({ provider: req.user.id }).sort({ createdAt: -1 });

    // Auto-seed realistic initial sample bookings if none exist for new provider demo
    if (bookings.length === 0) {
      const sampleBookings = [
        {
          provider: req.user.id,
          customerName: 'Tanvir Ahmed',
          customerPhone: '01712345678',
          customerAddress: 'House 42, Road 11, Banani, Dhaka',
          serviceTitle: 'Pipe Leakage Repair & Inspection',
          bookingDate: 'Tomorrow, 10:00 AM',
          price: 1200,
          status: 'pending',
          notes: 'Water leaking under the kitchen sink.',
        },
        {
          provider: req.user.id,
          customerName: 'Nusrat Jahan',
          customerPhone: '01887654321',
          customerAddress: 'Sector 4, Uttara, Dhaka',
          serviceTitle: 'Bathroom Tap Replacement',
          bookingDate: 'Today, 4:00 PM',
          price: 850,
          status: 'accepted',
          notes: 'New tap is already purchased.',
        },
        {
          provider: req.user.id,
          customerName: 'Rafiqul Islam',
          customerPhone: '01911223344',
          customerAddress: 'Block C, Bashundhara R/A, Dhaka',
          serviceTitle: 'Water Tank Cleaning & Servicing',
          bookingDate: 'Yesterday, 2:00 PM',
          price: 2500,
          status: 'completed',
          notes: 'Service completed successfully.',
        },
      ];
      bookings = await Booking.insertMany(sampleBookings);
    }

    res.status(200).json({ bookings });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ message: 'Server error fetching bookings', error: error.message });
  }
});

// 7. Update Booking Status (Accept, Complete, Cancel)
app.put('/api/provider/bookings/:id', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'accepted', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid booking status' });
    }

    const booking = await Booking.findOne({ _id: req.params.id, provider: req.user.id });
    if (!booking) {
      return res.status(404).json({ message: 'Booking request not found' });
    }

    const prevStatus = booking.status;
    booking.status = status;
    await booking.save();

    // If status changed to completed, increment completedJobsCount in profile
    if (status === 'completed' && prevStatus !== 'completed') {
      await ProviderProfile.findOneAndUpdate(
        { user: req.user.id },
        { $inc: { completedJobsCount: 1 } },
        { upsert: true }
      );
    }

    res.status(200).json({ message: `Booking status updated to ${status}`, booking });
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({ message: 'Server error updating booking status', error: error.message });
  }
});

// 8. Create a New Booking Request
app.post('/api/provider/bookings', authenticateToken, async (req, res) => {
  try {
    const { customerName, customerPhone, customerAddress, serviceTitle, bookingDate, price, notes } = req.body;

    if (!customerName || !customerPhone || !customerAddress || !serviceTitle || !bookingDate || !price) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const newBooking = new Booking({
      provider: req.user.id,
      customerName,
      customerPhone,
      customerAddress,
      serviceTitle,
      bookingDate,
      price: Number(price),
      notes: notes || '',
    });

    await newBooking.save();
    res.status(201).json({ message: 'Booking created successfully', booking: newBooking });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ message: 'Server error creating booking', error: error.message });
  }
});

// ----------------------------------------------------
// CUSTOMER DASHBOARD & SERVICE BOOKING API ROUTES
// ----------------------------------------------------

// 9. Get Customer Profile
app.get('/api/customer/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching customer profile', error: error.message });
  }
});

// 10. Update Customer Profile
app.put('/api/customer/profile', authenticateToken, async (req, res) => {
  try {
    const { fullName, phone } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        ...(fullName && { fullName: fullName.trim() }),
        ...(phone && { phone: phone.trim() }),
      },
      { new: true }
    );
    res.status(200).json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: 'Server error updating profile', error: error.message });
  }
});

// 11. Get Customer Bookings
app.get('/api/customer/bookings', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    let bookings = await Booking.find({
      $or: [{ customer: req.user.id }, { customerPhone: user.phone }],
    }).sort({ createdAt: -1 });

    // Seed sample bookings for customer demo if none exist
    if (bookings.length === 0) {
      const sampleCustomerBookings = [
        {
          customer: req.user.id,
          customerName: user.fullName,
          customerPhone: user.phone,
          customerAddress: 'House 14, Road 5, Banani, Dhaka',
          serviceTitle: 'AC Repair & Servicing',
          bookingDate: '25 Sep 2026',
          price: 1500,
          status: 'pending',
          notes: 'Master bedroom AC needs gas refill.',
        },
        {
          customer: req.user.id,
          customerName: user.fullName,
          customerPhone: user.phone,
          customerAddress: 'House 14, Road 5, Banani, Dhaka',
          serviceTitle: 'Home Deep Cleaning',
          bookingDate: '22 Sep 2026',
          price: 2500,
          status: 'accepted',
          notes: 'Full flat cleaning required.',
        },
        {
          customer: req.user.id,
          customerName: user.fullName,
          customerPhone: user.phone,
          customerAddress: 'House 14, Road 5, Banani, Dhaka',
          serviceTitle: 'Electrical Wiring Inspection',
          bookingDate: '18 Sep 2026',
          price: 1000,
          status: 'completed',
          notes: 'Main circuit breaker checked.',
        },
      ];
      bookings = await Booking.insertMany(sampleCustomerBookings);
    }

    res.status(200).json({ bookings });
  } catch (error) {
    console.error('Error fetching customer bookings:', error);
    res.status(500).json({ message: 'Server error fetching bookings', error: error.message });
  }
});

// 12. Create New Customer Booking Request
app.post('/api/customer/bookings', authenticateToken, async (req, res) => {
  try {
    const { serviceTitle, customerAddress, bookingDate, price, notes, providerId } = req.body;

    if (!serviceTitle || !customerAddress || !bookingDate || !price) {
      return res.status(400).json({ message: 'Service title, address, booking date, and price are required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const newBooking = new Booking({
      customer: user._id,
      provider: providerId || null,
      customerName: user.fullName,
      customerPhone: user.phone,
      customerAddress,
      serviceTitle,
      bookingDate,
      price: Number(price),
      notes: notes || '',
      status: 'pending',
    });

    await newBooking.save();
    res.status(201).json({ message: 'Booking request created successfully!', booking: newBooking });
  } catch (error) {
    console.error('Error creating customer booking:', error);
    res.status(500).json({ message: 'Server error creating booking', error: error.message });
  }
});

// 13. Cancel Customer Booking
app.post('/api/customer/bookings/:id/review', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ message: 'Only customers can review a booking' });
    }

    const { rating, comment = '' } = req.body;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be a whole number from 1 to 5' });
    }
    if (typeof comment !== 'string' || comment.trim().length > 500) {
      return res.status(400).json({ message: 'Review must be 500 characters or fewer' });
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      customer: req.user.id,
    });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Only completed bookings can be reviewed' });
    }
    if (!booking.provider) {
      return res.status(400).json({ message: 'This booking is not linked to a service provider' });
    }
    if (booking.review?.rating !== undefined) {
      return res.status(409).json({ message: 'This booking has already been reviewed' });
    }

    const reviewedBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        customer: req.user.id,
        status: 'completed',
        'review.rating': { $exists: false },
      },
      {
        $set: {
          review: {
            rating,
            comment: comment.trim(),
            createdAt: new Date(),
          },
        },
      },
      { new: true, runValidators: true }
    );
    if (!reviewedBooking) {
      return res.status(409).json({ message: 'This booking has already been reviewed' });
    }

    res.status(201).json({ message: 'Review submitted successfully', booking: reviewedBooking });
  } catch (error) {
    console.error('Error submitting booking review:', error);
    res.status(500).json({ message: 'Server error submitting review', error: error.message });
  }
});

app.put('/api/customer/bookings/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, customer: req.user.id });
    if (!booking) {
      return res.status(404).json({ message: 'Booking request not found' });
    }

    booking.status = 'cancelled';
    await booking.save();
    res.status(200).json({ message: 'Booking cancelled successfully', booking });
  } catch (error) {
    res.status(500).json({ message: 'Server error cancelling booking', error: error.message });
  }
});

// 14. Get List of Available Service Providers
app.get('/api/providers/list', async (req, res) => {
  try {
    const profiles = await ProviderProfile.find().populate('user', 'fullName email phone');
    res.status(200).json({ providers: await attachReviewSummaries(profiles) });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching provider profiles', error: error.message });
  }
});

// ----------------------------------------------------
// ADMINISTRATOR DASHBOARD & MANAGEMENT API ROUTES
// ----------------------------------------------------

// 15. Admin System Overview Stats
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const totalProviders = await User.countDocuments({ role: 'provider' });
    const totalBookings = await Booking.countDocuments();
    const pendingBookings = await Booking.countDocuments({ status: 'pending' });
    const completedBookings = await Booking.countDocuments({ status: 'completed' });
    const pendingVerifications = await ProviderProfile.countDocuments({ verificationStatus: 'pending' });

    const completedList = await Booking.find({ status: 'completed' }).select('price');
    const totalRevenue = completedList.reduce((sum, b) => sum + (b.price || 0), 0);

    res.status(200).json({
      totalUsers,
      totalCustomers,
      totalProviders,
      totalBookings,
      pendingBookings,
      completedBookings,
      pendingVerifications,
      totalRevenue,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ message: 'Server error fetching admin stats', error: error.message });
  }
});

// 16. Get All Users List
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.status(200).json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error fetching users', error: error.message });
  }
});

// 17. Block / Unblock User Account
app.put('/api/admin/users/:id/toggle-block', authenticateAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot block your own admin account.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    res.status(200).json({
      message: `User ${user.fullName} has been ${user.isBlocked ? 'blocked' : 'unblocked'}.`,
      user,
    });
  } catch (error) {
    console.error('Error toggling user block status:', error);
    res.status(500).json({ message: 'Server error updating user status', error: error.message });
  }
});

// 18. Delete User
app.delete('/api/admin/users/:id', authenticateAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own admin account.' });
    }

    await User.findByIdAndDelete(req.params.id);
    await ProviderProfile.findOneAndDelete({ user: req.params.id });
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error deleting user', error: error.message });
  }
});

// 19. Get All Providers with Profiles
app.get('/api/admin/providers', authenticateAdmin, async (req, res) => {
  try {
    const profiles = await ProviderProfile.find().populate('user', 'fullName email phone isBlocked');
    const profilesWithReviews = await attachReviewSummaries(profiles);
    res.status(200).json({ providers: profilesWithReviews });
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ message: 'Server error fetching providers', error: error.message });
  }
});

// 20. Verify / Reject Provider
app.put('/api/admin/providers/:id/verify', authenticateAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'verified', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be pending, verified, or rejected' });
    }

    const profile = await ProviderProfile.findByIdAndUpdate(
      req.params.id,
      { verificationStatus: status },
      { new: true }
    ).populate('user', 'fullName email phone isBlocked');

    if (!profile) {
      return res.status(404).json({ message: 'Provider profile not found' });
    }

    const [profileWithReviews] = await attachReviewSummaries([profile]);
    res.status(200).json({
      message: `Provider status set to ${status.toUpperCase()}`,
      provider: profileWithReviews,
    });
  } catch (error) {
    console.error('Error verifying provider:', error);
    res.status(500).json({ message: 'Server error verifying provider', error: error.message });
  }
});

// 21. Get All Platform Bookings
app.get('/api/admin/bookings', authenticateAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('provider', 'fullName email phone')
      .populate('customer', 'fullName email phone')
      .sort({ createdAt: -1 });

    res.status(200).json({ bookings });
  } catch (error) {
    console.error('Error fetching all bookings:', error);
    res.status(500).json({ message: 'Server error fetching bookings', error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('Smart Local Service Finder Backend API running');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
