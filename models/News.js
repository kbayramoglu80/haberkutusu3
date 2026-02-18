const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    required: true,
    enum: ['Gündem', 'Ekonomi', 'Spor', 'Siyaset', 'Yaşam', 'Sağlık'],
    default: 'Gündem'
  },
  image: {
    type: String,
    default: ''
  },
  featured: {
    type: Boolean,
    default: false
  },
  placement: {
    type: String,
    enum: ['none', 'homepage', 'hero'],
    default: 'none'
  }
}, {
  timestamps: true
});

newsSchema.index({ category: 1, createdAt: -1 });
newsSchema.index({ featured: 1 });
newsSchema.index({ placement: 1, createdAt: -1 });

module.exports = mongoose.model('News', newsSchema);
