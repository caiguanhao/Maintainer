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

function permissions_for_user(user) {
  var job = this;
  if (user.is_root) {
    return { read: true, write: true, execute: true };
  }
  var read = false, write = false, execute = false;
  for (var i = 0; i < job.permissions.length; i++) {
    var permission = job.permissions[i];
    if (permission.user.toString() === user._id.toString()) {
      switch (permission.bits) {
      case 4:
        read = true;
        write = false;
        execute = false;
        break;
      case 5:
        read = true;
        write = false;
        execute = true;
        break;
      case 7:
        read = true;
        write = true;
        execute = true;
        break;
      }
      break;
    }
  }
  return { read: read, write: write, execute: execute };
}

job_schema.method('permissions_for_user', permissions_for_user);

job_schema.method('sanitize_permissions', function(user) {
  var job = this.toObject();
  job.permissions = permissions_for_user.call(job, user);
  return job;
});

job_schema.static('sanitize_permissions_for_job', function(job, user) {
  job.permissions = permissions_for_user.call(job, user);
  return job;
});

module.exports = mongoose.model('Job', job_schema);
