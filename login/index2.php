<?php
require("success_login.php");
//session_save_path('session_data');
//session_start();
$shop_ID=$_SESSION['shop_ID'];
$kedai_nama=$_SESSION['shop_name'];

?>
<!DOCTYPE html>
<html lang="en" >
<head>
  <meta charset="UTF-8">
  <title>Makan makan 點餐平台後台</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/normalize/5.0.0/normalize.min.css">
 <meta name="viewport" content="width=device-width,initial-scale=1">
<style type="text/css">
	@charset "UTF-8";
.navigation {
  	height: 70px;
	background: #E5E2E2;
	box-shadow: 0px 5px 10px 0px #aaa;
}

.brand {
  position: absolute;
  padding-left: 20px;
  float: left;
  line-height: 70px;
  text-transform: uppercase;
  font-size: 1.4em;
	color:#000000;
}
.brand a,
.brand a:visited {
  color: #ffffff;
  text-decoration: none;
}

.nav-container {
  max-width: 100%;
  margin: 0 auto;
}

nav {
  float: right;
	height: 100%;
}
nav ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
nav ul li {
  float: left;
  position: relative;
}
nav ul li a,
nav ul li a:visited {
  display: block;
  padding: 0 20px;
  line-height: 70px;
  background:#A49F9F;
  color: #ffffff;
  text-decoration: none;
}
nav ul li a:hover,
nav ul li a:visited:hover {
  background:#7C7B7B;
  color: #ffffff;
}
nav ul li a:not(:only-child):after,
nav ul li a:visited:not(:only-child):after {
  padding-left: 4px;
  content: " ▾";
}
nav ul li ul li {
  min-width: 190px;
}
nav ul li ul li a {
  padding: 15px;
  line-height: 20px;
}

.nav-dropdown {
  position: absolute;
  display: none;
  z-index: 1;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.15);
}

/* Mobile navigation */
.nav-mobile {
  display: none;
  position: absolute;
  top: 0;
  right: 0;
  background: #262626;
  height: 70px;
  width: 70px;
}

@media only screen and (max-width: 798px) {
  .nav-mobile {
    display: block;
  }

  nav {
    width: 100%;
    padding: 70px 0 15px;
  }
  nav ul {
    display: none;
  }
  nav ul li {
    float: none;
  }
  nav ul li a {
    padding: 15px;
    line-height: 20px;
  }
  nav ul li ul li a {
    padding-left: 30px;
  }

  .nav-dropdown {
    position: static;
  }
}
	
@media screen and (min-width: 799px) {
  .nav-list {
    display: block !important;
  }
}
	
#nav-toggle {
  position: absolute;
  left: 18px;
  top: 22px;
  cursor: pointer;
  padding: 10px 35px 16px 0px;
}
#nav-toggle span,
#nav-toggle span:before,
#nav-toggle span:after {
  cursor: pointer;
  border-radius: 1px;
  height: 5px;
  width: 35px;
  background: #ffffff;
  position: absolute;
  display: block;
  content: "";
  transition: all 300ms ease-in-out;
}
#nav-toggle span:before {
  top: -10px;
}
#nav-toggle span:after {
  bottom: -10px;
}
#nav-toggle.active span {
  background-color: transparent;
}
#nav-toggle.active span:before, #nav-toggle.active span:after {
  top: 0;
}
#nav-toggle.active span:before {
  transform: rotate(45deg);
}
#nav-toggle.active span:after {
  transform: rotate(-45deg);
}

article {
  max-width: 100%;
  margin: 0 auto;
  padding: 10px;
	height: 100%
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
<section class="navigation">
  <div class="nav-container">
    <div class="brand">
      <a href="#!"><img src="../image/logo.png" width="116" height="40" alt=""/></a><?php echo $kedai_nama ?>
    </div>
    <nav>
      <div class="nav-mobile"><a id="nav-toggle" href="#!"><span></span></a></div>
      <ul class="nav-list">
        <li>
          <a href="productCRUD.php"  target="iframe_a">後台管理系統</a>
        </li>
        <li>
          <a href="account/receipt.php"  target="iframe_a">收費系統</a>
        </li>
        <li>
          <a href="cook/index.php"  target="iframe_a">廚師做菜系統</a>
        </li>
        <li>
          <a href="send/index.php"  target="iframe_a">送菜系統</a>
        </li>
      </ul>
    </nav>
  </div>
</section>

<article>
	
	<div class="iframe-container">
		<iframe style='display:block;top:0;left:0;position:absolute;width:100%;height:100%;' frameborder='0' scrolling='no' src="productCRUD.php" allowfullscreen="true" name="iframe_a"	></iframe>
	</div>
	<!----
	<div style="padding-bottom:56.25%; position:relative; display:block; width: 100%">
  		<iframe width="100%" height="100%" src="productCRUD.php"
    	frameborder="0" allowfullscreen="" style="position:absolute; top:0; left: 0" name="iframe_a">
  		</iframe>
	</div>---->
</article>
<!-- partial -->
  <script src='//cdnjs.cloudflare.com/ajax/libs/jquery/2.1.3/jquery.min.js'></script>
<script>
	(function($) { // Begin jQuery
  		$(function() { // DOM ready
    
	  	// If a link has a dropdown, add sub menu toggle.
    	$('nav ul li a').click(function() {
     		$('nav ul').slideToggle();
    	});
    	// Clicking away from dropdown will remove the dropdown class
    	$('html').click(function() {
      		$('.nav-dropdown').hide();
    	});
    	// Toggle open and close nav styles on click
    	$('#nav-toggle').click(function() {
      		$('nav ul').slideToggle();
    	});
    	// Hamburger to X toggle
   /*  $('#nav-toggle').on('click', function() {
      		this.classList.toggle('active');
    	});
	*/
  		}); // end DOM ready
	})(jQuery); // end jQuery
</script>
</body>
</html>
