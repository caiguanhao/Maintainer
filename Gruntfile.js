module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    less: {
      bootstrap_default: {
        options: {
          paths: [ 'assets/css/bootstrap/default' ]
        },
        files: {
          'public/css/vendor/bootstrap-default.css': 'assets/css/bootstrap/vendor/bootstrap.less'
        }
      },
      bootstrap_cerulean: {
        options: {
          paths: [ 'assets/css/bootstrap/cerulean' ]
        },
        files: {
          'public/css/vendor/bootstrap-cerulean.css': 'assets/css/bootstrap/vendor/bootstrap.less'
        }
      }
    },
    watch: {
      gruntfile: {
        files: [ 'Gruntfile.js' ]
      },
      js: {
        files: [ 'assets/js/**/*.js', 'assets/css/**/*.css', 'public/**/*.html' ],
        options: {
          livereload: true
        }
      },
      server: {
        files: [ '<%= pkg.main %>', 'models/**', 'doc/index.json' ],
        tasks: [ 'express', 'delay' ],
        options: {
          spawn: false
        }
      },
      server_again: {
        files: [ '<%= pkg.main %>', 'models/**', 'doc/index.json' ],
        options: {
          livereload: true
        }
      },
      doc: {
        files: [ 'doc/*.md' ],
        tasks: [ 'make_help_index' ],
        options: {
          livereload: true
        }
      }
    },
    express: {
      server: {
        options: {
          script: '<%= pkg.main %>'
        }
      }
    }
  });

  // page is reloaded before express server is restarted
  // the browser may fail to connect, so we delay the reload
  grunt.registerTask('delay', 'livereload is too fast to reload', function() {
    setTimeout(this.async(), 1000);
  });

  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-express-server');

  grunt.registerTask('default', [ 'express', 'watch' ]);

  grunt.registerTask('make_help_index', 'Generate help index JSON file', function() {
    var path = require('path');
    var doc_dir = 'doc';
    var help_files = grunt.file.expand({
      cwd: doc_dir
    }, '*.md');
    var index = {};
    help_files.forEach(function(help_file) {
      var file = grunt.file.read(path.join(doc_dir, help_file));
      var yfm = file.match(/^---((.|\n)*)---\n/);
      var title = '';
      if (yfm) {
        yfm = yfm[1].trim();
        title = yfm.match(/^title:\s*(.*)$/mi)
        if (title) title = title[1].trim();
        title = title.replace(/^(["']?)(.*)\1$/, '$2');
      }
      var slug = path.basename(help_file, path.extname(help_file));
      index[slug] = title;
    });
    grunt.file.write(path.join(doc_dir, 'index.json'),
      JSON.stringify(index, null, 2) + '\n');
  });

};
