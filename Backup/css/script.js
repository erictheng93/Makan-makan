$(".tabContent").hide(); 
 $("ul.tabs li:first").addClass("active").show(); 
 $(".tabContent:first").show(); 
//$("ul.tabs li:eq(2)").addClass("active").show(); //second
//$(".tabContent:eq(2)").show(); //second
 
  $("ul.tabs li").click(function () {
    $("ul.tabs li").removeClass("active"); 
    $(this).addClass("active"); 
    $(".tabContent").hide(); 
    var activeTab = $(this).find("a").attr("href"); 
    $(activeTab).fadeIn(); 
    return false;
  });