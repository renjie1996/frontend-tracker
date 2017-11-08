module.exports = function (grunt) {
  grunt.initConfig({
    eslint: {
      target: ['src/tracker.js']
    },

    uglify: {
      options: {
        sourceMap: true
      },
      build: {
        src: 'src/tracker.js',
        dest: 'dist/tracker.min.js'
      }
    }
  })

  grunt.loadNpmTasks('grunt-contrib-uglify')
  grunt.loadNpmTasks('grunt-eslint')

  grunt.registerTask('lint', ['eslint'])
  grunt.registerTask('pack', ['uglify:build'])
  grunt.registerTask('default', ['lint', 'pack'])
}
