on('ready', function() {
    on('add:graphic', function(obj) { log(obj.get('imgsrc')); });
});