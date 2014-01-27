function Common() {
  this.section = null;
  this.methods = [];
  this.common_methods = {
    schema_methods: {
      __: function(schema, name, content) {
        schema.method(name, content);
      },
      // remove document keys that having select: false set in schema,
      // but keep if the query force selecting these keys
      sanitize: function() {
        var document = this;
        var model = document.constructor;
        for (var path_name in model.schema.paths) {
          if (document.isSelected(path_name)) continue;
          if (model.schema.paths[path_name].selected === false) {
            document[path_name] = undefined;
          }
        }
        return document;
      }
    }
  }
}

Common.prototype.of = function(section) {
  this.section = section;
  return this;
}

Common.prototype.including = function() {
  this.methods = Array.prototype.slice.call(arguments);
  return this;
};

Common.prototype.all = function() {
  this.methods = null;
  return this;
};

Common.prototype.give_to = function(schema) {
  var section = this.common_methods[this.section];
  if (!section) return;

  if (!this.methods) {
    this.methods = Object.keys(section).filter(function(name) {
      return name[0] !== '_';
    });
  }

  for (var i = 0; i < this.methods.length; i++) {
    var func_name = this.methods[i];
    section.__(schema, func_name, section[func_name]);
  }
};

module.exports = Common;
