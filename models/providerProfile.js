import mongoose from 'mongoose';

const providerProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    serviceCategory: {
      type: String,
      default: 'Plumbing',
      trim: true,
    },
    bio: {
      type: String,
      default: 'Experienced local service professional dedicated to quality work.',
    },
    hourlyRate: {
      type: Number,
      default: 500,
    },
    location: {
      type: String,
      default: 'Dhaka, Bangladesh',
      trim: true,
    },
    experienceYears: {
      type: Number,
      default: 3,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    rating: {
      type: Number,
      default: 4.8,
    },
    completedJobsCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model('ProviderProfile', providerProfileSchema);
