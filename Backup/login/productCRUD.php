<?php
require("success_login.php");
?>
<!DOCTYPE html>
<html lang="en" >
<head>
  <meta charset="UTF-8">
  <title>CodePen - Responsive Tabs w/ Dropdown Menu</title>

<style type="text/css">
	hr {
		margin-top:-30px;
	}
	.tabs-container nav {
	  margin: 0 auto;
	  background: #fff;
	}

	.tabs-container nav ul {
	  list-style: none;
	  margin: 0;
	  padding: 0;
	  border: 1px solid #ccc;
	  padding: 0 10px;
	}

	.tabs-container nav ul li {
	  padding: 1rem;
	  cursor: pointer;
	  color: #A7A7A7;
	  border-top: 1px solid #eee;
	  margin-left: -10px;
	  margin-right: -10px;
	  padding-left: 25px;
	}

	.tabs-container nav ul li:hover {
	  color: #3e4b58;
	}

	.tabs-container nav ul li.active {
	  color: #3e4b58;
	  border-top: none;
	}

	/* the nitty gritty */
	.tabs-container {
	  position: relative;
	  height: 4em;
	}

	.tabs-container nav {
	  position: absolute;
	  width: 100%;
	}

	.tabs-container nav ul {
	  display: flex;
	  flex-direction: column;
	}

	.tabs-container nav ul li {
	  order: 1;
	}

	.tabs-container nav ul li.active {
	  order: 0;
	}

	.tabs-container nav ul li.active:after {
	  width: 1px;
	  height: 1px;
	  border: 5px solid transparent;
	  border-top: 5px solid #555;
	  content: "";
	  position: absolute;
	  right: 1.5em;
	  top: 1.4em;
	  z-index: 9999;
	}

	.tabs-container nav ul li:not(.active) {
	  position: absolute;
	  top: -999em;
	}

	.tabs-container nav ul.expanded li.active:after {
	  border-top-color: transparent;
	  border-bottom-color: #555;
	  top: 1em;
	}

	.tabs-container nav ul.expanded li:not(.active) {
	  position: relative;
	  top: auto;
	}

	@media all and (min-width: 42em) {
	  nav {
		background: transparent;
	  }

	  .tabs-container nav ul li.active {
		box-shadow: inset 0 -3px 0 #5098B3;
	  }

	  .tabs-container nav ul {
		display: flex;
		flex-direction: row;
		justify-content: center;
		white-space: nowrap;
		overflow: hidden;
		border: none;
		padding: 0;
	  }

	  .tabs-container nav ul li {
		display: inline-block;
		margin: 0 1rem 0 1rem;
		padding: 0 0 0.2rem 0;
		border: none;
	  }

	  .tabs-container nav ul li:not(.active) {
		position: relative;
		top: auto;
	  }

	  .tabs-container nav ul li.active {
		order: 1;
	  }

	  .tabs-container nav ul li.active:after {
		display: none;
	  }
	}
	.tab-content {
	  display: none;
	  padding: 15px;
	}

	.tab-content.current {
	  display: inherit;
	}
	/**----- responsive iframe   ----**/
	
	.iframe-container{
	  position: relative;
	  margin: 0;
	  width:10em;
	  display: inline-block;
	  background:white;
	  width:100%;
	  padding: 0 0 200%;

		& iframe{
		  position: absolute;
		  top: 0;
		  right: 0;
		  bottom: 0;
		  left: 0;
		  width: 100%;
		  height:100%;
		  }
	}
</style>
</head>
<body>
<!-- partial:index.partial.html -->
<div class="tabs-container">
  <nav class="tabs">
    <ul>
      <li class="active" data-tab="tab-1">商品資料(CRUD)</li>
      <li data-tab="tab-2">結帳系統</li>
      <li data-tab="tab-3">項目資料(CRUD)</li>
      <li data-tab="tab-4">列印QR Code</li>
      <li data-tab="tab-5">人員管理系統</li>
      
    </ul>
  </nav>
</div>
<hr>
<div id="tab-1" class="tab-content current">
	<div class="iframe-container">
		<iframe style='display:block;top:0;left:0;position:absolute;width:100%;height:100%;' frameborder='0' scrolling='no' src="edit/productAdd1-2.php" allowfullscreen="true" name="iframe_a"	></iframe>
	</div>
</div>
<div id="tab-2" class="tab-content">

</div>
</div>
<div id="tab-3" class="tab-content">
	<div class="iframe-container">
		<iframe style='display:block;top:0;left:0;position:absolute;width:100%;height:100%;' frameborder='0' scrolling='no' src="catedit/catedit.php" allowfullscreen="true" name="iframe_a"	></iframe>
	</div>
</div>
<div id="tab-4" class="tab-content">
	<div class="iframe-container">
		<iframe style='display:block;top:0;left:0;position:absolute;width:100%;height:100%;' frameborder='0' scrolling='no' src="phpqr/qrcode-form-index.php" allowfullscreen="true" name="iframe_a"	></iframe>
	</div>
</div>
<div id="tab-5" class="tab-content">
	<div class="iframe-container">
		<iframe style='display:block;top:0;left:0;position:absolute;width:100%;height:100%;' frameborder='0' scrolling='no' src="personal/index.php" allowfullscreen="true" name="iframe_a"	></iframe>
	</div>
</div>
	
<!-- partial -->
  	<script src='//cdnjs.cloudflare.com/ajax/libs/jquery/2.1.3/jquery.min.js'></script>
	<script>
		$(document).on('click', 'li', function(){
		  $('li').removeClass('active');
		  $('ul').toggleClass('expanded');
		  $(this).addClass('active');
		  var tab_id = $(this).attr('data-tab');
		  $('.tab-content').removeClass('current');
		  $(this).addClass('current');
		  $('#'+tab_id).addClass('current');
		});
	</script>

</body>
</html>
