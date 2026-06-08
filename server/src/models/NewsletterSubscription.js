import mongoose from 'mongoose';

const newsletterSubscriptionSchema = new mongoose.Schema(
  {
    email: { 
      type: String, 
      required: true, 
      trim: true, 
      lowercase: true, 
      unique: true,
      maxlength: 254 
    },
    status: {
      type: String,
      enum: ['active', 'unsubscribed'],
      default: 'active'
    },
    subscribedAt: { 
      type: Date, 
      default: Date.now 
    },
    unsubscribedAt: { 
      type: Date 
    },
    source: {
      type: String,
      default: 'website_footer',
      trim: true
    }
  },
  { timestamps: true }
);

newsletterSubscriptionSchema.index({ email: 1 });
newsletterSubscriptionSchema.index({ status: 1 });
newsletterSubscriptionSchema.index({ createdAt: -1 });

export default mongoose.models.NewsletterSubscription || 
  mongoose.model('NewsletterSubscription', newsletterSubscriptionSchema);
