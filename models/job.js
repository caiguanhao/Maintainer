var mongoose = require('mongoose'), Schema = mongoose.Schema;

var job_model = {
  title: { type: String, required: true },
  content: { type: String, required: true },
  created_at: { type: Date }
};

module.exports = mongoose.model('Job', new Schema({
  available: { type: Boolean, default: true },
  published: job_model,
  revisions: [ job_model ],
  revision_count: { type: Number, default: 1 },
  permissions: [{
    user: { type: Schema.ObjectId, ref: 'User' },
    bits: Number
  }],
  created_at: { type: Date },
  updated_at: { type: Date }
}));
