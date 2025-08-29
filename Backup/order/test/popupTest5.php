<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>無標題文件</title>
	<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://www.w3schools.com/w3css/4/w3.css">
</head>

<body>
<div class="w3-container">
  <h2>W3.CSS Modal</h2>
  <p>Use w3-container classes to create different sections in the modal (e.g. header & footer).</p>
  <button onclick="document.getElementById('id01').style.display='block'" class="w3-button w3-black">Open Modal</button>
  	<p><a href="index.html" target="iframe2" rel="modal:open" onclick="document.getElementById('id01').style.display='block'" class="w3-button w3-black">Visit website</a></p>
	<p><a href="order.php" target="iframe2" rel="modal:open" onclick="document.getElementById('id01').style.display='block'" class="w3-button w3-black">Visit website</a></p>		
  
	<div id="id01" class="w3-modal">
		<!--<div class="w3-modal-content">-->
		  <div class="w3-modal-content w3-card-4" style="max-width:80%;height:500px">
			  <header class="w3-container w3-teal"> 
				<span onclick="document.getElementById('id01').style.display='none'" 
				class="w3-button w3-display-topright">&times;</span>
				<h2>Modal Header</h2>
			  </header>
			  <div class="w3-container" tyle="height:450px">
				<iframe style="width:100%;height:400px"allowfullscreen name="iframe2" ></iframe>
			  </div>
			  <footer class="w3-container w3-teal">
				<p>Modal Footer</p>
			  </footer>
		</div>
  	</div>
</div>
</body>
</html>