<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>無標題文件</title>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.0.0/jquery.min.js"></script>
<!-- jQuery Modal -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-modal/0.9.1/jquery.modal.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/jquery-modal/0.9.1/jquery.modal.min.css" />
</head>
<style type="text/css">
	body {font-family: Arial, Helvetica, sans-serif;}

/* The Modal (background) */
.modal {
  display: none; /* Hidden by default */
  position: fixed; /* Stay in place */
  z-index: 100; /* Sit on top */
  padding-top: 0px; /* Location of the box */
  left: 0;
  top: 0;
  width: 100%; /* Full width */
  height: 100%; /* Full height */
  overflow: hidden; /* Enable scroll if needed */
  background-color: rgb(0,0,0); /* Fallback color */
  background-color: rgba(0,0,0,0.4); /* Black w/ opacity */
}

/* Modal Content */
.modal-content {
  background-color: #fefefe;
  margin: auto;
  padding: 0px;
  border: 0px solid #888;
  width: 100%;
  height: 100%;
  overflow: scroll; /* Enable scroll if needed */
  -webkit-overflow-scrolling: touch;
  max-height: none;
}

/* The Close Button */
.close {
  color: #ffffff;
  background-color: rgb(255,0,0);
  position: absolute;
  padding-left: 8px;
  padding-right: 8px;
  right: 0px;
  font-size: 36px;
  font-weight: bold;
}

.close:hover,
.close:focus {
  color: #000;
  text-decoration: none;
  cursor: pointer;
}
</style>
<body>
<div style="width:inherit;height:90%" id="ex1" class="modal">
  <iframe style="width:inherit;height:inherit;"allowfullscreen src="index.html"></iframe>
  <a href="#" rel="modal:close">Close</a>
</div>
<!-- Link to open the modal -->
<p><a href="#ex1" rel="modal:open">Visit website</a></p>
</body>
</html>