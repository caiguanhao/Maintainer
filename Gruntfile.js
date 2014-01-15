module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    watch: {
      options: {
        livereload: true
      },
      gruntfile: {
        files: [ 'Gruntfile.js' ]
      },
      js: {
        files: [ 'assets/js/**/*.js', 'assets/css/**/*.css', 'public/**/*.html' ]
      },
      server: {
        files: [ '<%= pkg.main %>', 'models/**' ],
        tasks: [ 'develop' ],
        options: {
          nospawn: true
        }
      }
    },
    develop: {
      server: {
        file: '<%= pkg.main %>'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-develop');

  grunt.registerTask('default', [ 'develop', 'watch' ]);

};
