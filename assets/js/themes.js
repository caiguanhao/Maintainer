(function(){
  window.THEMES = /*! REPLACE-START */["cerulean","default","kitchen-sink","slate","spacelab","united"]/*! REPLACE-END */;
  window.UPDATE_THEME = function(_theme) {
    var theme = 'default';
    for (var i = 0; i < window.THEMES.length; i++) {
      if (window.THEMES[i] === _theme) theme = _theme;
    }
    window.CURRENT_THEME = theme;
    window.localStorage.theme = theme;
    document.getElementById('bootstrap').href =
      '/css/vendor/bootstrap-' + theme + '.css';
  };
  document.writeln('<link id="bootstrap" rel="stylesheet">');
  var theme;
  if (window.localStorage && window.localStorage.theme) {
    theme = window.localStorage.theme;
  }
  window.UPDATE_THEME(theme);
})();
