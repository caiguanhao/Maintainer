(function(){
  window.THEMES = /*! REPLACE-START */["cerulean","default","slate","spacelab","united"]/*! REPLACE-END */;
  var theme = 'default';
  if (window.localStorage && window.localStorage.theme) {
    var _theme = window.localStorage.theme;
    if (_theme) {
      for (var i = 0; i < window.THEMES.length; i++) {
        if (window.THEMES[i] === _theme) theme = _theme;
      }
    }
  }
  window.UPDATE_THEME = function(theme) {
    window.CURRENT_THEME = theme;
    window.localStorage.theme = theme;
    document.getElementById('bootstrap').href =
      '/css/vendor/bootstrap-' + theme + '.css';
  };
  document.writeln('<link id="bootstrap" rel="stylesheet">');
  window.UPDATE_THEME(theme);
})();
