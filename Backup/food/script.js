$(document).foundation();

$('#example-vert-tabs').on('change.zf.tabs', function() {
  $('.title-bar').foundation('toggleMenu');
});