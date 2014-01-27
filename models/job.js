var mongoose = require('mongoose'), Schema = mongoose.Schema;

var job_model = {
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true },
  created_at: { type: Date }
};

var job_schema = new Schema({
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
});

job_schema.path('published.title').validate(function(value) {
  return value.length <= 30;
}, 'Title is too long. It should be less than or equal to 30 characters.');

job_schema.path('permissions').schema.path('bits').validate(function(value) {
  return (value === 4 || value === 5 || value === 7);
}, 'Permission bits should be 4 or 5 or 7.');

module.exports = mongoose.model('Job', job_schema);
