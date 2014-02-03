module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    less: {
      /* make_theme_index task will put some targets here */
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
      /* make_theme_index task will put some targets here */
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

  grunt.registerTask('default', [ 'make_theme_index', 'less', 'express', 'watch' ]);

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

  grunt.registerTask('make_theme_index', 'Generate theme index JSON file', function() {
    var themes = grunt.file.expand({
      cwd: 'assets/css/vendor/bootstrap',
      filter: 'isDirectory'
    }, '*', '!src');
    var themes_str = JSON.stringify(themes);
    var theme_js_file = 'assets/js/themes.js'
    var theme_js = grunt.file.read(theme_js_file);
    var deli_start = '/*! REPLACE-START */';
    var deli_end = '/*! REPLACE-END */';
    var start = theme_js.indexOf(deli_start);
    var end = theme_js.indexOf(deli_end);
    var new_theme_js;
    if (start >= 0 && end > start + deli_start.length &&
      theme_js.slice(start + deli_start.length, end) !== themes_str) {
      new_theme_js = theme_js.slice(0, start + deli_start.length);
      new_theme_js += themes_str;
      new_theme_js += theme_js.slice(end);
      grunt.file.write(theme_js_file, new_theme_js);
      grunt.log.ok('Updated ' + theme_js_file);
    } else {
      grunt.log.ok('No need to update ' + theme_js_file);
    }

    var less = grunt.config('less');
    themes.forEach(function(theme) {
      var files = {};
      files['public/css/vendor/bootstrap-' + theme + '.css'] =
        'assets/css/vendor/bootstrap/src/bootstrap.less';
      less['bootstrap-' + theme] = {
        options: {
          paths: [ 'assets/css/vendor/bootstrap/' + theme ]
        },
        files: files
      };
    });
    grunt.config('less', less);

    var watch = grunt.config('watch');
    themes.forEach(function(theme) {
      watch['bootstrap-' + theme] = {
        files: [ 'assets/css/vendor/bootstrap/' + theme + '/*.less' ],
        tasks: [ 'make_theme_index', 'less:bootstrap-' + theme ],
        options: {
          livereload: true
        }
      }
    });
    grunt.config('watch', watch);
  });

};
