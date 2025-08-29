$('#submit').on('click',function(){
  var rating = $("input[name=rating]:checked").attr('value');
  var name = $('#alias').val();
  var review = $('#review').val();
  if(rating == '0'){
    $('.error').html('Please select rating');
    
  }else if(name == ''){
    $('.error').html('Please enter name');
  }else if(name.length <=2 || name.legth >=50){
     $('.error').html('Please enter name in less than 50 Characters');
  }else if(review == ''){
    $('.error').html('Please enter review');
  }else if(review.length <=2 || review.legth >=250){
     $('.error').html('Please enter review in less than 250 Characters');
  }else{
    $('.error').html('');       
    alert(rating+'|'+name+'|'+review);
    $('.rating-form').hide();
    $('.rating-success').addClass('active');
  }
})