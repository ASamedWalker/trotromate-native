package com.troski.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.troski.wear.data.WearDataSync
import com.troski.wear.presentation.TroskiWearApp

/**
 * Wear OS entry point — single Activity hosting Jetpack Compose UI.
 * Initializes WearDataSync and hands it to the composable tree.
 */
class MainActivity : ComponentActivity() {

    private lateinit var dataSync: WearDataSync

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        dataSync = WearDataSync.getInstance(this)

        setContent {
            TroskiWearApp(dataSync = dataSync)
        }
    }
}
