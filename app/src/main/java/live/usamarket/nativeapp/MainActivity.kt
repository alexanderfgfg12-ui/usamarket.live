package live.usamarket.nativeapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Image
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.Alignment
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.URL

private data class Article(val id:String,val title:String,val description:String,val image:String,val category:String,val content:String)
private suspend fun fetchArticles(): List<Article> = withContext(Dispatchers.IO) {
    val json = URL("https://usamarket.live/news-data.json").readText()
    val array = JSONObject(json).optJSONArray("articles") ?: return@withContext emptyList()
    (0 until array.length()).map { i ->
        val a = array.getJSONObject(i)
        Article(a.optString("id"),a.optString("title"),a.optString("description"),a.optString("image"),a.optString("category"),a.optString("content"))
    }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MarketApp() }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MarketApp() {
    var articles by remember { mutableStateOf<List<Article>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var query by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("all") }
    var selected by remember { mutableStateOf<Article?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableIntStateOf(0) }
    LaunchedEffect(refreshKey) {
        loading = true
        error = null
        try { articles = fetchArticles() } catch (e: Exception) { error = "تعذر تحميل الأخبار. تحقق من اتصال الإنترنت." }
        loading = false
    }
    val filtered = articles.filter {
        (category == "all" || it.category.equals(category,true)) &&
        (query.isBlank() || it.title.contains(query,true) || it.description.contains(query,true))
    }
    MaterialTheme(colorScheme = lightColorScheme(primary = androidx.compose.ui.graphics.Color(0xFF102B55))) {
        Scaffold(topBar = {
            TopAppBar(title = { Row(verticalAlignment = Alignment.CenterVertically) { Image(painterResource(R.drawable.ic_market_logo), contentDescription = "US Market Live", modifier = Modifier.size(36.dp)); Spacer(Modifier.width(10.dp)); Text("US Market Live", fontWeight = FontWeight.Bold) } })
        }) { padding ->
            Column(Modifier.fillMaxSize().padding(padding).padding(horizontal=16.dp)) {
                if (selected != null) {
                    TextButton(onClick={selected=null}) { Text("← العودة إلى الأخبار") }
                    Text(selected!!.title, style=MaterialTheme.typography.headlineSmall, fontWeight=FontWeight.Bold)
                    Spacer(Modifier.height(12.dp))
                    if (selected!!.image.isNotBlank()) AsyncImage(selected!!.image,null,Modifier.fillMaxWidth().height(210.dp),contentScale=ContentScale.Crop)
                    Spacer(Modifier.height(12.dp))
                    Text(android.text.Html.fromHtml(selected!!.content,android.text.Html.FROM_HTML_MODE_COMPACT).toString(), style=MaterialTheme.typography.bodyLarge)
                } else {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("أخبار الأسواق الأمريكية", style=MaterialTheme.typography.headlineSmall, fontWeight=FontWeight.Bold)
                        TextButton(onClick = { refreshKey++ }, enabled = !loading) { Text("تحديث") }
                    }
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(query,{query=it},Modifier.fillMaxWidth(),singleLine=true,label={Text("ابحث في الأخبار")})
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        listOf("all","markets","crypto","technology","economy").forEach { c ->
                            FilterChip(selected=category==c,onClick={category=c},label={Text(if(c=="all") "الكل" else c)})
                        }
                    }
                    when {
                        loading -> Box(Modifier.fillMaxSize(),contentAlignment=androidx.compose.ui.Alignment.Center){CircularProgressIndicator()}
                        error != null -> Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text(error!!, color = MaterialTheme.colorScheme.error)
                            Button(onClick = { refreshKey++ }) { Text("إعادة المحاولة") }
                        }
                        filtered.isEmpty() -> Text("لا توجد أخبار مطابقة.")
                        else -> LazyColumn(verticalArrangement=Arrangement.spacedBy(12.dp),contentPadding=PaddingValues(vertical=12.dp)) {
                            items(filtered) { article ->
                                Card(Modifier.fillMaxWidth().clickable { selected=article },shape=RoundedCornerShape(16.dp)) {
                                    Column(Modifier.padding(12.dp)) {
                                        if(article.image.isNotBlank()) AsyncImage(article.image,null,Modifier.fillMaxWidth().height(170.dp),contentScale=ContentScale.Crop)
                                        Spacer(Modifier.height(8.dp))
                                        Text(article.category.uppercase(),color=MaterialTheme.colorScheme.primary,style=MaterialTheme.typography.labelMedium)
                                        Text(article.title,style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold)
                                        Text(article.description,style=MaterialTheme.typography.bodyMedium,maxLines=3)
                                        Text("اقرأ المقال ←",color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.SemiBold)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
