<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>無標題文件</title>
<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css">
<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js"></script>
<script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/js/bootstrap.min.js"></script>
</head>
<body>
<div class="container">
    <h2>Pop Up Modals</h2>
    <a href="index.html" class="btn btn-primary" onclick="return show_modal(this);">Open YouTube Video 1</a>
    <a href="index.php" class="btn btn-primary" onclick="return show_modal(this);">Open YouTube Video 2</a>
</div>

<div class="modal fade" id="myModal" role="dialog">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal">&times;</button>
                <h4 class="modal-title">Modal Header</h4>
            </div>
            <div class="modal-body">
                <iframe id="iframe_modal" src="" style="width: 100%; height: 40%;"></iframe>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>
            </div>
        </div>
    </div>
</div>
<script>
	function show_modal(e)
{
    console.log (e.href);
    $("#iframe_modal").attr("src", e.href);
    $('#myModal').modal('show');
    return false;
}
	
</script>
</body>
</html>